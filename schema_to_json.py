import requests
import shutil
from extruct.jsonld import JsonLdExtractor
from bs4 import BeautifulSoup
from html_sanitizer import Sanitizer, sanitizer
from w3lib.html import get_base_url
from datetime import datetime, timedelta
import html2text
import pprint
import json
import os
import hashlib
from PIL import Image
from io import BytesIO
from ics import Calendar, Event, ContentLine

PLACEHOLDER_IMAGE = "images/FocusCoE_placeholder.webp"


def image_dimensions(image):
    from PIL import Image

    # get image
    img = Image.open(image)

    # get width and height
    return img.width, img.height


def parse_extra_metadata(metadata_string):
    """Parse the string containing the additional metadata"""

    extra_metadata = {}
    # each item is separated by a semicolon (only keep non-empty values)
    items = [x.strip() for x in metadata_string.split(";") if x.strip()]
    # the key and value have a colon between them
    for item in items:
        key_value_pair = [x.strip() for x in item.split(":")]
        # should not have more than 2 elements
        if len(key_value_pair) != 2:
            raise ValueError(
                "Entry %s should have a single ':' to be a key/value pair"
                % key_value_pair
            )
        key = key_value_pair[0].lower()
        # all values are considered a list that is comma separated (only keep non-empty values)
        value_list = [x.strip() for x in key_value_pair[1].split(",") if x.strip()]

        if value_list:
            extra_metadata[key] = value_list

    return extra_metadata


def expand_metadata(metadata):
    """Expand the additional metadata from the HPC Portal and inject it into the json"""

    if "review" in metadata:
        # Extract the reviewBody which is the temporary home for our additional metadata
        extra_metadata_string = metadata["review"]["reviewBody"]
        extra_metadata = parse_extra_metadata(extra_metadata_string)
        metadata.update(extra_metadata)

        # Remove the review now that we've parsed it
        del metadata["review"]

    # Make sure start date is before end date
    myformat = "%Y-%m-%dT%H:%M:%S%z"
    event_begin = datetime.strptime(metadata["startDate"], myformat)
    event_end = datetime.strptime(metadata["endDate"], myformat)
    if event_begin > event_end:
        print(
            "\nEvent %s has start date after end date, making assumptions to correct!"
            % metadata["@id"]
        )
        initial_end = event_end.strftime(myformat)
        # Assume that the event should actually end on the same day
        event_end = event_end.replace(
            year=event_begin.year,
            month=event_begin.month,
            day=event_begin.day,
            tzinfo=event_begin.tzinfo,
        )
        if event_begin > event_end:
            # If this is still the case just assume it is the next day
            event_end = event_end + timedelta(days=1)
        print(
            "- For start date %s, changed event end date from %s to %s\n"
            % (
                event_begin.strftime(myformat),
                initial_end,
                event_end.strftime(myformat),
            )
        )
    metadata["endDate"] = event_end.strftime(myformat)

    # Make sure event url is valid:
    if "url" in metadata:
        header = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:97.0) Gecko/20100101 Firefox/97.0"
        }
        try:
            response = requests.get(
                metadata["url"], headers=header, verify=True, timeout=10
            )
        except requests.exceptions.SSLError:
            try:
                response = requests.get(
                    metadata["url"], headers=header, verify=False, timeout=10
                )
            except Exception as error:
                # Ignore any exceptions
                print("Exception as warning: ", error)
                response = None
        except Exception as error:
            # Ignore any exceptions
            print("Exception as warning: ", error)
            response = None
        # If we don't get a non-error response, remove the key
        if response is None or response.status_code != 200:
            # TODO - check if URL can be framed and add a key for this
            del metadata["url"]

    # It at this point we don't have a URL, just use @id
    # (this is the URL of the event on the main website and should be valid)
    if "url" not in metadata:
        metadata["url"] = metadata["@id"]

    # Let's cache a compressed version of the image (if it exists)
    if "url" in metadata["image"]:
        try:
            response = requests.get(metadata["image"]["url"])
        except Exception as error:
            # Ignore any exceptions
            print("Exception as warning: ", error)
            response = None
        # If we get a non-error response, let's cache the image
        if response:
            image = Image.open(BytesIO(response.content))
            image = image.convert("RGBA")
            image.thumbnail((720, 720), Image.ANTIALIAS)
            final_image_path = os.path.join(
                "tmp_images",
                "".join(hashlib.md5(metadata["@id"].encode()).hexdigest()) + ".webp",
            )
            image.save(final_image_path, "webp")
            metadata["image"]["url"] = final_image_path
        else:
            # Something went wrong with the URL (let's kick it out)
            metadata["image"].pop("url", None)

    # If there is no image URL, should update that entry with a placeholder
    if "url" not in metadata["image"]:
        metadata["image"]["url"] = PLACEHOLDER_IMAGE

    # Reset width and height based on our cached image
    width, height = image_dimensions(metadata["image"]["url"])
    metadata["image"]["width"] = width
    metadata["image"]["height"] = height
    # 'description' is html. Let's make that plain text and add a summary,
    # but also keep the html description when injecting the full event info

    # This strips out newlines to just leave the plain html (without CSS/javascript nasties)
    html_description = my_sanitizer.sanitize(metadata["description"])

    metadata["html_description"] = html_description

    # Get a new soup from this and store that
    # soup = BeautifulSoup(html_description, features="lxml")
    # metadata["html_description"] = repr(soup)

    # Make our plain text description (no images or links!)
    text_maker = html2text.HTML2Text()
    text_maker.ignore_images = True
    text_maker.ignore_links = True
    text_maker.body_width = 0
    plaintext_description = text_maker.handle(html_description).strip()
    metadata["description"] = plaintext_description
    # Also make a Markdown description
    text_maker.ignore_images = False
    text_maker.ignore_links = False
    plaintext_description = text_maker.handle(html_description).strip()
    metadata["markdown_description"] = plaintext_description

    # Create a summary of 140 chars (or less)
    summary_length = 140
    if len(metadata["description"]) < summary_length:
        metadata["summary"] = metadata["description"]
    else:
        max_summary_length = summary_length - 5
        summary_text = plaintext_description[:max_summary_length]
        # make sure the string ends on the last white space
        summary_text = summary_text[::-1]  # reverse it
        summary_text = summary_text.split(
            None, 1
        )  # split it on the first whitespace, keep the rest
        if len(summary_text) > 1:
            summary_text = summary_text[1]
        else:
            summary_text = summary_text[0]
        summary_text = summary_text[::-1]  # reverse it back
        metadata["summary"] = summary_text.strip() + "..."

    return metadata


def filter_jsonld(jsondata):
    filtered_data = []

    for item in jsondata:
        # Make sure we got our expected context
        valid_data = False
        if item["@context"] == "https://schema.org":
            # Make sure we only have one element with our expected type
            kept_elements = [
                element for element in item["@graph"] if element["@type"] == "Event"
            ]
            if len(kept_elements) == 1:
                # expand extra metadata
                item["@graph"] = [expand_metadata(kept_elements[0])]
                # Could keep adding more filters here
                valid_data = True

        if valid_data:
            filtered_data.append(item)
    # We are not expected more than one event in each jsondata arg
    if len(filtered_data) != 1:
        raise ValueError(
            "Length of filtered data is not 1, got %s" % len(filtered_data)
        )

    return filtered_data[0]


def create_calendar_event_from_jsonld(event):
    # pprint.pprint(event)
    my_event = Event()
    my_event.summary = event["name"]
    print (event["name"])
    my_event.uid = event["@id"]
    if hasattr(event, "url"):
        my_event.url = event["url"]
        # Neither Google Calendar nor Outlook support the URL field of an ics
        # so let's inject the event URL into the HTML description
        url_html = (
            '<p><b>Event Link:</b> <a href="'
            + event["url"]
            + '">'
            + event["url"]
            + "</a></p>"
        )
    else:
        url_html = ""
    my_event.description = url_html + event["html_description"]
    if hasattr(event, "projects"):
        my_event.categories = event["projects"]
    my_event.begin = datetime.strptime(event["startDate"], "%Y-%m-%dT%H:%M:%S%z")
    my_event.end = datetime.strptime(event["endDate"], "%Y-%m-%dT%H:%M:%S%z")
    my_event.geo = {
        "latitude": float(event["location"]["geo"]["latitude"]),
        "longitude": float(event["location"]["geo"]["longitude"]),
    }
    my_event.location = event["location"]["url"]
    html_content = (
        "<!DOCTYPE HTML><HTML><BODY>" + event["html_description"] + "</BODY></HTML>"
    )
    my_event.extra.append(
        ContentLine(
            name="X-ALT-DESC", params={"FMTTYPE": ["text/html"]}, value=html_content
        )
    )
    return my_event


def write_events(events, file_stub="all_events"):
    # Now store our events in batches of 5 (or less).
    # This will allow us to gradually create a custom site
    # Rather than have to load a single huge json file.
    n_events = 5
    events_chunks = [events[i : i + n_events] for i in range(0, len(events), n_events)]
    file_id = 1
    for events_chunk in events_chunks:
        with open(f"{file_stub}.{file_id}.json", "w") as fp:
            json.dump(events_chunk, fp)
        file_id += 1
        fp.close()
    # Convert our events to ical
    calendar = Calendar()
    for event in events:
        cal_event = create_calendar_event_from_jsonld(event["@graph"][0])
        calendar.events.append(cal_event)
    # Write the ics file in full
    with open(f"{file_stub}.ics", "w") as ics_file:
        ics_file.writelines(calendar)
    ics_file.close()


pp = pprint.PrettyPrinter(indent=2)

# Make a copy of sanitizer settings
my_settings = dict(sanitizer.DEFAULT_SETTINGS)

# Add your changes
my_settings["tags"].add("img")
my_settings["empty"].add("img")
my_settings["attributes"].update({"img": ("src",)})

# Use it
my_sanitizer = Sanitizer(settings=my_settings)

headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:52.0) Gecko/20100101 Firefox/52.0",
}

jslde = JsonLdExtractor()

# Site information (assumption is a Drupal site and a view with a pager)
root_url = "https://hpc-portal.eu/"
verify_ssl_cert = True  # check page has valid cert
events_page = "coe-training-events/"

# Loop over pages until we run out articles
page = 0
# events per page must be an allowed option under "Items per page"
events_per_page = 20
all_events = []
while True:
    url = (
        root_url
        + events_page
        + "?items_per_page="
        + str(events_per_page)
        + "&page="
        + str(page)
    )
    # increment page count
    page += 1
    req = requests.get(url, headers, verify=verify_ssl_cert)
    soup = BeautifulSoup(req.content, "html.parser")

    articles = soup.find_all("article")
    if not articles:
        break
    for article in articles:
        node_id = article["about"]
        url = root_url + node_id
        req = requests.get(url, headers, verify=verify_ssl_cert)
        base_url = get_base_url(req.text, req.url)
        data = jslde.extract(req.text, base_url=base_url)
        # Filter the data
        kept_data = filter_jsonld(data)
        if kept_data:
            all_events.append(kept_data)

events_filestub = "eurohpc_events"
write_events(all_events, file_stub=events_filestub)

print("\nProcessed a total of %s events\n\n" % len(all_events))

# Create event feeds for individual projects
projects = [
    "EuroCC/CASTIEL",
    "PRACE",
    "BioExcel-2",
    "ChEESE",
    "CoEC",
    "CompBioMed",
    "E-CAM",
    "EoCoE-II",
    "ESiWACE2",
    "EXCELLERAT",
    "HiDALGO",
    "MaX",
    "NOMAD",
    "PerMedCoE",
    "POP",
    "RAISE",
    "TREX",
    "FocusCoE",
]

for project in projects:
    # Make a copy of the project template folder
    project_allowed_values = []
    source_dir = "template_project"
    destination_dir = "project_" + project.replace("/", "_")
    # Remove the directory if it exists
    if os.path.isdir(destination_dir):
        shutil.rmtree(destination_dir)
    shutil.copytree(
        source_dir,
        destination_dir,
        symlinks=True,
        ignore=None,
        copy_function=shutil.copy2,
        ignore_dangling_symlinks=False,
        dirs_exist_ok=False,
    )
    # Copy over a placeholder image
    placeholder_image = os.path.join("images", project + "_placeholder.webp")
    if not os.path.isfile(placeholder_image):
        placeholder_image = os.path.join("images", "placeholder.webp")
    shutil.copy(
        placeholder_image, os.path.join(destination_dir, "images", "placeholder.webp")
    )

    # Create an allowed list of projects
    project_list = [project]
    # FocusCoE is special since it is all CoEs together (i.e., not PRACE or EuroCC/CASTIEL)
    if project == "FocusCoE":
        project_list = [
            proj
            for proj in projects
            if proj
            not in [
                "EuroCC/CASTIEL",
                "PRACE",
            ]
        ]

    # Create a list of events that match the project
    project_events = [
        event
        for event in all_events
        if set(project_list).intersection(set(event["@graph"][0].get("projects", [])))
    ]

    print("Project set %s has %s events." % (project_list, len(project_events)))

    # Write our events
    write_events(
        project_events, file_stub=os.path.join(destination_dir, events_filestub)
    )
