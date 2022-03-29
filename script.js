/* Set up our global variables */
// Get our id
hpc_events_element = document.getElementById("hpc_events")

// Set the website that hosts the data (use '' for local page)
var website = hpc_events_element.getAttribute("data-website")
if (!website) {
    website = '';
}
// Set the country if specified
const restrict_country = hpc_events_element.hasAttribute("data-country") ? hpc_events_element.getAttribute("data-country") : null;

// Set the project subfolder
const project_subfolder = hpc_events_element.getAttribute("data-project");
const known_projects = [
    "EuroCC_CASTIEL",
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
if (project_subfolder && project_subfolder.length != 0) {
  if (known_projects.includes(project_subfolder)) {
    website = website + '/' + 'project_' + project_subfolder;
  } else {
    alert("Ignoring " + project_subfolder + " as it is not in list of known projects: " + known_projects)
  }
}

// Set the filestub to use to pull in data
var events_stub = hpc_events_element.getAttribute("data-filestub");
if (!events_stub) {
    events_stub = 'eurohpc_events';
}

// Script id in html
const script_id = "hpc_events";

// json filetype
let json_filestub = "json";

// boolean to hold whether we found any events
no_events = false;

// number of events we add to page
let event_cnt = 0;

/* Add our functions */
function loadScript(url, callback)
{
    // Adding the script tag to the head as suggested before
    var head = document.head;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    script.onreadystatechange = callback;
    script.onload = callback;

    // Fire the loading
    head.appendChild(script);
}

function toggleIframe (myModalOverlay, myModal) {
  myModalOverlay.classList.toggle('open')
  myModal.classList.toggle('open')
}

function openIframe (iframe, iframeSrc, myModalOverlay, myModal) {
  if (!iframe.hasAttribute('src')) { iframe.src = iframeSrc }
  toggleIframe(myModalOverlay, myModal)
}

function addEventToPage (jsonData, count) {
  // Clone the event template
  const event = eventTemplate.content.cloneNode(true)
  const countStr = '-' + count.toString()

  // Gather the elements we will be updating
  const eventDict = {}
  eventDict.iframe = event.getElementById('event_url')
  eventDict.image = event.getElementById('event_image')
  eventDict.title = event.getElementById('event_title')
  eventDict.summary = event.getElementById('event_summary')
  eventDict.description = event.getElementById('event_description')
  eventDict.date = event.getElementById('event_date')
  eventDict.place = event.getElementById('event_place')
  // and also get the interface elements
  eventDict.eventModal = event.getElementById('modal')
  eventDict.eventModalOverlay = event.getElementById('modal_overlay')
  eventDict.eventOpenButton = event.getElementById('open_button')
  eventDict.eventNewtabButton = event.getElementById('newtab_button')
  eventDict.eventCloseButton = event.getElementById('close_button')
  //eventDict.eventDropdownApple = event.getElementById('eventLinkApple')
  eventDict.eventDropdownGoogle = event.getElementById('eventLinkGoogle')
  eventDict.eventDropdownOutlook = event.getElementById('eventLinkOutlook')
  // Update all their id's with our iterator
  for (const value of Object.values(eventDict)) {
    value.id = value.id + countStr
  }

  // Update the elements with our json data
  var have_url = false
  if ('url' in jsonData) {
    var iframeSrc = jsonData.url // note we don't set the iframe source yet to delay iframe loading until it is required
    have_url = true
  }

  eventDict.image.src = website + '/' + jsonData.image.url // update the content
  // Don't set image info as it messes with the css
  //eventDict.image.width = jsonData.image.width
  //eventDict.image.style.height = 'auto'
  eventDict.title.innerHTML = jsonData.name.trim() // update the content
  start_date = (new Date(jsonData.startDate)).toDateString()
  end_date = (new Date(jsonData.endDate)).toDateString()
  if (start_date == end_date) {
    dates = start_date;
  } else {
    //if the year is the same, drop that off the start date
    if (start_date.slice(-4) == end_date.slice(-4)) {
      start_date = start_date.slice(0,-5);
    }
    // Drop day of the week to shorten string (first 4 characters)
    dates = start_date.slice(4) + " - " + end_date.slice(4);
  }
  eventDict.date.innerHTML = dates
  // If the event is online or hybrid, say so, otherwise use the country field
  mode = jsonData.eventAttendanceMode
  if ( mode.includes("Mixed") ) {
    place = "Hybrid"
  } else if ( mode.includes("Online") ) {
    place = "Online"
  } else {
    place = jsonData.country[0]
  }
  eventDict.place.innerHTML = place
  // eventDict.description.innerHTML = jsonData.description.substring(0, 128).trim() + '...' // update the content
  eventDict.summary.innerHTML = jsonData.summary
  eventDict.description.innerHTML = jsonData.html_description // update the content

  // Add the URLs for our "Add to calendar button"
  const calendarOptions = {
    title: jsonData.name.trim(),
    location: jsonData.location.url,
    description: jsonData.html_description,
    start: new Date(jsonData.startDate),
    end: new Date(jsonData.endDate)
  }
  //const icalendar = new datebook.ICalendar(calendarOptions)
  //eventDict.eventDropdownApple.href = icalendar.render()
  const googleCalendar = new datebook.GoogleCalendar(calendarOptions)
  eventDict.eventDropdownGoogle.href = googleCalendar.render()
  const outlookCalendar = new datebook.OutlookCalendar(calendarOptions)
  eventDict.eventDropdownOutlook.href = outlookCalendar.render()

  // Configure the triggers
  if (have_url) {
    // New tab button
    eventDict.eventNewtabButton.onclick = function () { window.open(iframeSrc, '_blank') }
    // Iframe button
    eventDict.eventOpenButton.onclick = function () { openIframe(document.getElementById(eventDict.iframe.id), iframeSrc, document.getElementById(eventDict.eventModal.id), document.getElementById(eventDict.eventModalOverlay.id)) } // update the content
    eventDict.eventCloseButton.onclick = function () { toggleIframe(document.getElementById(eventDict.eventModal.id), document.getElementById(eventDict.eventModalOverlay.id)) }
    eventDict.eventModalOverlay.onclick = function () { toggleIframe(document.getElementById(eventDict.eventModal.id), document.getElementById(eventDict.eventModalOverlay.id)) }
  } else {
    // if we don't have the url remove the elements altogether
    eventDict.eventNewtabButton.parentNode.removeChild(eventDict.eventNewtabButton);
    eventDict.eventOpenButton.parentNode.removeChild(eventDict.eventOpenButton);
    eventDict.eventCloseButton.parentNode.removeChild(eventDict.eventCloseButton);
    eventDict.eventModalOverlay.parentNode.removeChild(eventDict.eventModalOverlay);
  }

  // Append the event to the list (if it is not already finished)
  const today = new Date()
  const endDate = new Date(jsonData.endDate)
  if (endDate.getTime() > today.getTime()) {
    eventList.appendChild(event)
  }
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch (Exception) {
    return true;
  }
}

async function addEventsFromURL (url, json_ld = false) {
  const response = await fetch(url);
  const response_ok = await response.ok;

  file_exists = true;
  if (!response_ok) {
    console.log('404 Not Found (' + url + '): ' + response.statusText);
    file_exists = false;
  } else {
    const events = await response.json();
    console.log('Got these events: ', events);

    for (let i = 0; i < events.length; i++) {
        // each entry has an @graph element and is list (with 1 entry)
        // Skip the event if country is set and the event's country does not match ...
        if (restrict_country !== null && !events[i]["@graph"][0]['country'].includes(restrict_country)) {
	   continue;
	}
        // ... otherwise add it.
        addEventToPage(events[i]["@graph"][0], event_cnt)
	event_cnt++;
    }
    console.log('Total number of events: ', event_cnt);
    if (event_cnt < 1) {
	warning_html = `
            <div class="hpc-events"><center><h3>There are no upcoming events!</h3></center><div>
        `;
        document.getElementById("my_searchbox").innerHTML = warning_html;
    }
    if (json_ld) {
        const jsonldScript = document.createElement('script');
        jsonldScript.setAttribute('type', 'application/ld+json');
        jsonldScript.textContent = JSON.stringify(events);
        document.head.appendChild(jsonldScript);
    }
  }

  return file_exists;
}

async function inject_events() {
  // load json files in sequence until we run out of files
  let base_url = website + '/';  // local file

  file_exists = true;
  file_id = 1;
  json_ld = true;
  while (file_exists) {
    url = base_url.concat(events_stub).concat('.').concat(file_id).concat('.').concat(json_filestub)
    file_exists = await addEventsFromURL(url, json_ld=json_ld);
    if (file_id == 1 && file_exists == false) {
        // Remove our events section and replace searchbox html with a warning
        document.getElementById("events-section").remove();
        warning_html = `
            <div class="hpc-events"><center><h3>There are no upcoming events!</h3></center><div>
        `;
        document.getElementById("my_searchbox").innerHTML = warning_html;
    }
    // Only inject the first 3 sets of events as our json_ld data
    if (file_id == 3) {
      json_ld = false;
    }
    file_id += 1;
    if (file_id > 100) {
      console.log("Something went wrong, we've tried to load more than 100 URLs!");
      file_exists = false;
    }
  }
}

function liveSearch() {
  // Locate the event elements
  let events = document.querySelectorAll('.events-section > ul > li')
  // Locate the search input
  let search_query = document.getElementById("searchbox").value;
  // Loop through the events
  for (var i = 0; i < events.length; i++) {
    // If the text is within the card...
    if(events[i].textContent.toLowerCase()
      // ...and the text matches the search query...
      .includes(search_query.toLowerCase())) {
        // ...remove the `.is-hidden` class.
        events[i].classList.remove("is-hidden");
    } else {
      // Otherwise, add the class.
      events[i].classList.add("is-hidden");
    }
  }
}

function inject_preload_style(url){
    var link = document.createElement("link");
    link.href = url;
    link.type = "text/css";
    link.rel = "preload";
    link.as = "style";
    link.onload = function() {this.rel='stylesheet'};
    document.getElementsByTagName("head")[0].appendChild(link);
}

/* Inject our html */

// Add our external styles
inject_preload_style(website + "/" + "css/all.css");
inject_preload_style("https://fonts.googleapis.com/css?family=IBM+Plex+Serif|Source+Sans+Pro:300,400,600&display=swap");

// Add our main style
var link = document.createElement("link");
link.href = website + "/" + "css/hpc-event-style.css";
link.type = "text/css";
link.rel = "stylesheet";
document.getElementsByTagName("head")[0].appendChild(link);

// Find the parent of the script element
parent_element = hpc_events_element.parentElement;

// Add our search box section
var x = document.createElement("section");
x.setAttribute("id", "my_searchbox");
x.setAttribute("class", "events-section my-searchbox");
const searchbox_html = `
    <table width="100%">
        <tr>
            <th id="calendar_feed_cell" width="50%">
                <label for="calendar_feed">Event feed:</label>
                <span style="white-space: nowrap;">
                    <a id="calendar_feed">Download</a>
                    <a onclick='let text=document.getElementById("calendar_feed").href;navigator.clipboard.writeText(text);alert("Copied the text: " + text);'>Copy URL</a>
                </span>
            </th>
            <th width="50%">
                <label for="searchbox">Search events:</label>
                <input type="search" id="searchbox" placeholder="Type text to search for">
            </th>
        </tr>
    </table>
`;
x.innerHTML = searchbox_html;
// Do not display download/copy link for feed if country filter is active...
if (restrict_country !== null && restrict_country.length > 0) {
	x.querySelector('#calendar_feed_cell').remove();
}
// ... if no country filter is active, add the correct URL.
else {
	// Set ics file
	x.querySelector("a#calendar_feed").href = website + "/" + events_stub + ".ics"
}
parent_element.appendChild(x);

// Add our template section
x = document.createElement("section");
x.setAttribute("id", "events-section");
x.setAttribute("class", "events-section");
const template_html = `
    <ul id="eurohpc_events" class="hpc_event">
        <template id="eurohpc_event_template">
            <li>
                <div class="modal-overlay" id="modal_overlay"></div>
                <div class="modal" id="modal">
                    <button class="close-button" id="close_button">Close</button>
                    <iframe id="event_url"></iframe>
                </div>
                <figure>
                    <img id="event_image" loading="lazy">
                    <figcaption><h3 id="event_title"></h3></figcaption>
                    <date><h3 id="event_date"></h3></date>
                    <place><h3 id="event_place"></h3></place>
                </figure>
                <p><span style="white-space:pre-line" id="event_summary"></span></p>
                <details>
                    <summary>Click here for more details</summary>
                    <p id="event_description"></p>
                </details>

                <div style="padding: 0.5rem; margin-top: auto;">
                    <center>
                    <div>
                        <button class="open-button" id="open_button" style="width: 80%;"><i class="fas fa-link"></i> Event website</button>
                        <button class="open-button" id="newtab_button" style="width: 15%;"><i class="fas fa-external-link-alt"></i></button>
                    </div>
                    <div style="padding: 0.5rem;">
                    <!-- <a id="eventLinkApple"> <i class="fab fa-apple" aria-hidden="true"></i> Apple calendar</a> -->
                    <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                    <a id="eventLinkGoogle" target="_blank"><i class="fab fa-google" aria-hidden="true"></i> Google</a>
                    <a id="eventLinkOutlook" target="_blank"><i class="fab fa-windows" aria-hidden="true"></i> Outlook</a>
                    </div>
                    </center>
                </div>
            </li>
        </template>
    </ul>
</section>
`;
x.innerHTML = template_html;
parent_element.appendChild(x);

// Configure delay for our searchbar
let typingTimer;
let typeInterval = 500; // Half a second
let searchInput = document.getElementById('searchbox');

searchInput.addEventListener('input', () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(liveSearch, typeInterval);
});

// If the main page is in an iframe, don't show the hero
if (inIframe()) {
  let hero = document.getElementsByClassName('hero')[0]
  if (hero != undefined) {
    hero.remove();
  }
}

// Now extract their location of our injected template
const eventTemplate = document.getElementById('eurohpc_event_template')
const eventList = document.getElementById('eurohpc_events')

// Load the datebook script, then inject the events
loadScript("https://cdn.jsdelivr.net/npm/datebook@7.0.7/dist/datebook.min.js", inject_events);
