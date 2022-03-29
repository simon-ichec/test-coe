/* Set up our global variables */
// Get our id
hpc_events_element = document.getElementById("hpc_events")

// Set the website that hosts the data (use '' for local page)
var website = hpc_events_element.getAttribute("data-website")
if (!website) {
    website = '';
}

// default main style sheet
//var main_style_href = website + "/" + "css/hpc-event-style.css";
var main_style_href = "https://fs.hlrs.de/projects/par/events/2022/test/" + "/" + "css/hpc-event-style.css";

// Set the country if specified
const restrict_country = hpc_events_element.hasAttribute("data-country") ? hpc_events_element.getAttribute("data-country") : null;

// Select which filters should be shown. Implemented are: language, format, country, level, sector
const filters_avail = hpc_events_element.hasAttribute("data-filters") ? hpc_events_element.getAttribute("data-filters").split(',').map(item => item.trim()) : [];

// Values defined in drupal (hpc-portal.eu)
filter_values = [];
filter_values['level'] = ['Difficulty Level', ['Beginner', 'Intermediate', 'Advanced', 'Other']];
if (hpc_events_element.hasAttribute("data-filter-options-country")) {
	filter_values['country'] = ['Country/NCC', hpc_events_element.getAttribute("data-filter-options-country").split(',').map(item => item.trim())];
}
else {
	filter_values['country'] = ['Country/NCC', [
	"Austria",
	"Belgium",
	"Bulgaria",
	"Croatia",
	"Cyprus",
	"Czech Republic",
	"Denmark",
	"Estonia",
	"Finland",
	"France",
	"Germany",
	"Greece",
	"Hungary",
	"Iceland",
	"Ireland",
	"Italy",
	"Latvia",
	"Lithuania",
	"Luxembourg",
	"Montenegro",
	"Netherlands",
	"North Macedonia",
	"Norway",
	"Poland",
	"Portugal",
	"Romania",
	"Slovakia",
	"Slovenia",
	"Spain",
	"Sweden",
	"Switzerland",
	"Turkey",
	"United Kingdom"
	]];
}
if (hpc_events_element.hasAttribute("data-filter-options-language")) {
	filter_values['language'] = ['Language', hpc_events_element.getAttribute("data-filter-options-language").split(',').map(item => item.trim())];
}
else {
	filter_values['language'] = ['Language of Instruction', [
	'Albanian',
	'Bulgarian',
	'Croatian',
	'Czech',
	'Danish',
	'Dutch',
	'English',
	'Estonian',
	'Finnish',
	'French',
	'German',
	'Greek',
	'Hungarian',
	'Icelandic',
	'Irish',
	'Italian',
	'Latvian',
	'Lithuanian',
	'Luxembourgish',
	'Macedonian',
	'Maltese',
	'Montenegrin',
	'Norwegian',
	'Other',
	'Polish',
	'Portuguese',
	'Romanian',
	'Slovak',
	'Slovene',
	'Spanish',
	'Swedish',
	'Turkish'
	]];
}
filter_values['sector'] = ['Audience', ["Research and Academia", "Industry", "Public Sector", "Other (general public...)"]];
filter_values['format'] = ['Format', ['In person', 'Mixed', 'Online']];

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

if (hpc_events_element.hasAttribute("data-filter-options-project")) {
	filter_values['projects'] = ['Project', hpc_events_element.getAttribute("data-filter-options-project").split(',').map(item => item.trim())];
}
else {
	filter_values['projects'] = ['Project', known_projects.map(function(item) {return item.replace('_','/');})];
}
const known_filters = ['level', 'language', 'country', 'sector', 'format', 'projects'];

// Mapping from schema.org strings to values in drupal (hpc-portal.eu)
var event_attendance_map = [];
event_attendance_map['https://schema.org/OfflineEventAttendanceMode'] = 'In person';
event_attendance_map['https://schema.org/MixedEventAttendanceMode'] = 'Mixed';
event_attendance_map['https://schema.org/OnlineEventAttendanceMode'] = 'Online';

// Number of displayed items
// var nr_dspl_items = Infinity;
var nr_dspl_items = hpc_events_element.hasAttribute("data-items-per-page") ? hpc_events_element.getAttribute("data-items-per-page") : Infinity;

// Offset of displayed items
var dspl_offset = 0;

// Declare global array for meta data of all events
var event_meta_data = [];

// Declare array for filters, i.e. for each available/actived filter an empty array
// that will hold active filter options.
var filters = [];
for (const filter of filters_avail) {
	filters[filter] = [];
}

// boolean that will be set true, if filter block is shown.
var show_filter_block = false;

// Set the project subfolder
const project_subfolder = hpc_events_element.getAttribute("data-project");

if (project_subfolder && project_subfolder.length != 0) {
  if (known_projects.includes(project_subfolder)) {
    website = website + '/' + 'project_' + project_subfolder;
    // If use-project-css property is set to "yes", use it.
    if (hpc_events_element.hasAttribute("data-project-css") && hpc_events_element.getAttribute("data-project-css" == "yes")) {
	    var main_style_href = "https://fs.hlrs.de/projects/par/events/2022/test" + "/" + "css/hpc-"+project+"-event-style.css";
    }
  } 
  else{ 
    alert("Ignoring " + project_subfolder + " as it is not in list of known projects: " + known_projects)
  }
}
// If no project is defined, but "data-main-css" exists, use this css instead (otherwise default defined above).
else {
   if (hpc_events_element.hasAttribute("data-main-css")) {
            var main_style_href = hpc_events_element.getAttribute("data-main-css");
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
var event_cnt = 0;

// number of events that match filters
var mtch_event_cnt = 0;

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

function close_details(e) {
	div_box = document.getElementById('eurohpc-overlay-top');
	if (div_box !== null) {
		const parent_nd = div_box.parentNode;
		const summary = parent_nd.querySelector('summary');
		summary.classList.remove('open');
		const nd_id=parent_nd.id;
		let el = parent_nd.querySelector('#eurohpc-overlay-top'); 
		el.remove();
		parent_nd.querySelector('#modal_overlay-'+nd_id).classList.remove('open');
	}
}

function open_details(e) {
	e.preventDefault(); 
	let li = this.parentNode.parentNode; 
	let id = li.id;
	const details = li.querySelector('details>p#event_description-'+id).cloneNode(true);
	const fig = li.querySelector('figure').cloneNode(true);
	let modal_overlay = this.parentNode.parentNode.querySelector('#modal_overlay-'+id); 
	modal_overlay.classList.add('open');
	this.classList.add('open');
	const x = document.createElement("div");
	x.setAttribute('id', 'eurohpc-overlay-top');
	x.appendChild(fig);
	x.appendChild(details);
	const close_but = document.createElement('button');
	close_but.innerHTML="Close";
	close_but.addEventListener('click', close_details);
	x.appendChild(close_but);
	li.appendChild(x);
}

function addEventToPage (jsonData, count) {
  // Clone the event template
  const event = eventTemplate.content.cloneNode(true)
  const countStr = '-' + count.toString()

  // Gather the elements we will be updating
  const eventDict = {}
  eventDict.iframe = event.getElementById('event_url')
  eventDict.li = event.getElementById('list_id')
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
  
  // Set event count as id in <li> tag
  eventDict.li.id = count;

  // Update global metadata
  let cur_metadata = [];
  cur_metadata['language'] = jsonData.language;
  cur_metadata['country'] = jsonData.country;
  cur_metadata['sector'] = jsonData.sector;
  cur_metadata['level'] = jsonData.level;
  // Since project is optional, set "['_none_']" as dummy if not existing
  if ('projects' in jsonData) {
	  cur_metadata['projects'] = jsonData.projects;
  }
  else {
	  cur_metadata['projects'] = ['_none_'];
  }	
  cur_metadata['format'] = event_attendance_map[jsonData.eventAttendanceMode];
  cur_metadata['start'] = jsonData.startDate;
  cur_metadata['end'] = jsonData.endDate;
  cur_metadata['hidden_by'] = new Set();
  event_meta_data[count] = cur_metadata;

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
    
  } else {
    // if we don't have the url remove the elements altogether
    eventDict.eventNewtabButton.parentNode.removeChild(eventDict.eventNewtabButton);
    eventDict.eventOpenButton.parentNode.removeChild(eventDict.eventOpenButton);
    eventDict.eventCloseButton.parentNode.removeChild(eventDict.eventCloseButton);
    // Keep ModalOverlay, since used for details
    //eventDict.eventModalOverlay.parentNode.removeChild(eventDict.eventModalOverlay);
  }
  eventDict.eventModalOverlay.onclick = function () {
	  let nd_id = this.parentNode.id; 
	  // Toggle iframe open only if really open.
	  if(this.parentNode.querySelector('#modal-'+nd_id).classList.contains('open')){
		  toggleIframe(document.getElementById(eventDict.eventModal.id), document.getElementById(eventDict.eventModalOverlay.id))
	  }
	  // Close details overlay
	  close_details(this);
  }
  event.querySelector('summary').onclick = open_details;
  // Append the event to the list (if it is not already finished)
  const today = new Date()
  const endDate = new Date(jsonData.endDate)
  // hide event if already loaded nr_dspl_items many.
  if (count >= nr_dspl_items) {
  	eventDict.li.classList.add("is-hidden");
  }
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
        // Skip the event if country is set and the event's country does not match ...
	if (restrict_country !== null && !events[i]["@graph"][0]['country'].includes(restrict_country)) {
	   continue;
	}
        // ... otherwise add it.
	addEventToPage(events[i]["@graph"][0], event_cnt)
	event_cnt++;
    }
    if (!show_filter_block && event_cnt > 0) {
	    add_filter_block();
	    show_filter_block = true;
    }
    console.log('Total number of events: ', event_cnt);
    if (json_ld) {
        const jsonldScript = document.createElement('script');
        jsonldScript.setAttribute('type', 'application/ld+json');
        jsonldScript.textContent = JSON.stringify(events);
        document.head.appendChild(jsonldScript);
    }
  }
  // we do not filter initially, so all events match no filter
  mtch_event_cnt = event_cnt;
  return file_exists;
}

// updates block with virtual pages (for item per page)
function update_pages_block() {
	// fetch element
	const pages_block = document.querySelector('#eurohpc-items-block>div>#pages-block');
	// only show this block if there are more items (after filtering) than should be on one page
	if (mtch_event_cnt > nr_dspl_items) {
		pages = "<span>Page </span><ol class='eurohpc_nav_buttons'>";
    if (dspl_offset == 0) {
      pages += "<li class='eurohpc_nav_button'><button class='eurohpc_page_item' disabled='true' aria-label='Previous Page'>Prev</button></li>";
    } else {
      pages += "<li class='eurohpc_nav_button'><button class='eurohpc_page_item' onClick='dspl_offset=Math.max(dspl_offset-"+(nr_dspl_items)+",0); set_hidden();' aria-label='Previous Page'>Prev</button></li>";
    }
		// Add page entry
		for (i=0; i<Math.ceil(mtch_event_cnt/nr_dspl_items); i++) {
			// If it is the current page, i.e. offset matches, then add active_page class
			if (dspl_offset == i*nr_dspl_items) {
				pages += "<li class='eurohpc_nav_button'><button class='eurohpc_page_item active_page' onClick='dspl_offset="+(i*nr_dspl_items)+"; set_hidden();' aria-label='page "+(i+1)+" current page'>"+(i+1)+"</button></li>";
			}
			else {
				pages += "<li class='eurohpc_nav_button'><button class='eurohpc_page_item' onClick='dspl_offset="+(i*nr_dspl_items)+"; set_hidden();' aria-label='page "+(i+1)+"'>"+(i+1)+"</button></li>";
			}
		}
    if (dspl_offset >= (Math.ceil(mtch_event_cnt/nr_dspl_items)*nr_dspl_items)-nr_dspl_items) {
      pages += "<li class='eurohpc_nav_button'><button class='eurohpc_page_item' disabled='true' aria-label='Next Page'>Next</button></li>";
    } else {
      pages += "<li class='eurohpc_nav_button'><button class='eurohpc_page_item' onClick='dspl_offset=Math.min(dspl_offset+"+(nr_dspl_items)+",mtch_event_cnt); set_hidden();' aria-label='Next Page'>Next</button></li>";
    }
    pages += "</ol>"
		pages_block.innerHTML = pages;
		//
	}
	else {
		pages_block.innerHTML = "";

	}
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
    // If we have no more urls and event_cnt < 1, then there are no events.
    if (file_exists == false && event_cnt < 1) {
        // Remove our events section and replace searchbox html with a warning
        document.getElementById("events-section").remove();
        warning_html = `
            <div class="hpc-events"><center><h3>There are no upcoming events!</h3></center><div>
        `;
        document.getElementById("my_searchbox").innerHTML = warning_html;
    }
    // Add page labels according to max items per page
    update_pages_block(); 
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

// Go through all events on the page an hide or unhide them
// depending on 'hidden_by' size
function set_hidden() {
  // we must count how many items match the currently active filters
  let displayable_items = 0;
  // and how many items are really visible
  let visible_items = 0;

  let events = document.querySelectorAll('.events-section > ul > li')
  // Loop through the events
  for (let i = 0; i < events.length; i++) {
    // If hidden by nothing
    if(event_meta_data[Number(events[i].id)]['hidden_by'].size === 0) {
	// count item
	displayable_items++;
        // ...remove the `.is-hidden` class if we are above the current offset 
	// and below the max. number of items per page
	if (displayable_items > dspl_offset && visible_items < nr_dspl_items) {
		events[i].classList.remove("is-hidden");
		// one more item visible
		visible_items++;
	}
	else{
		events[i].classList.add("is-hidden");
	}
    } else {
      // Otherwise, add the class.
      events[i].classList.add("is-hidden");
    }
  }
  mtch_event_cnt = displayable_items;
  update_pages_block();
}

function liveSearch() {
  // Locate the event elements
  let events = document.querySelectorAll('.events-section > ul > li')
  // Locate the search input
  let search_query = document.getElementById("searchbox").value;
  // Loop through the events
  for (let i = 0; i < events.length; i++) {
    // If the text is within the card...
    if(events[i].textContent.toLowerCase()
      // ...and the text matches the search query...
      .includes(search_query.toLowerCase())) {
        // ...remove `search` from hiding entries.
        event_meta_data[i]['hidden_by'].delete('search');
    } else {
      // Otherwise, add `search` to hiding entries.
      event_meta_data[i]['hidden_by'].add('search');
    }
  }
  // We changed the filter, therefore old offsets make no more sense.
  dspl_offset=0;
  // Hide/unhide events according to setting in meta data array
  set_hidden();
}

// Add/remove filter 'key' (e.g. 'level') from global event meta data 
// depending on 'selected_options' (e.g. ['Beginner', 'Intermediate']).
function fltr_by_array(key, selected_options) {
  for (let i = 0; i < event_meta_data.length; i++) {
    // If the events meta data include the specified format (or is undefined or empty list), 
    // do not hide this element because of the current filter
    if(selected_options === null ||  selected_options.length === 0 || selected_options.some((element) => event_meta_data[i][key].includes(element))) {
        event_meta_data[i]['hidden_by'].delete(key);
    } 
    // otherwise, we should mark it as hidden
    else {
        event_meta_data[i]['hidden_by'].add(key);
    }
  }
  // We changed the filter, therefore old offsets make no more sense.
  dspl_offset=0;
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
inject_preload_style("https://fs.hlrs.de/projects/par/events/2022/test" + "/" + "css/all.css");
inject_preload_style("https://fs.hlrs.de/projects/par/events/2022/test/css/filters.css");
inject_preload_style("https://fonts.googleapis.com/css?family=IBM+Plex+Serif|Source+Sans+Pro:300,400,600&display=swap");

// Add our main style
var link = document.createElement("link");
link.href = main_style_href;
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

// Variable to count active filters
var act_filter_count = 0;

// Event handler to apply filter
function applyFilters(e) {
  // which filter was clicked
  filter = this.getAttribute("data-filter");
  filter_option = this.getAttribute("data-filter_option");
  // If filter option was active, remove it ...
  if (filters[filter].includes(filter_option)) {
	  removeArrayItem(filter_option,filters[filter]);
	  const sub_index = filter_values[filter][1].indexOf(filter_option);
	  // also from list of active filter on the page
	  element = document.querySelector('#eurohpc_selected_filters_block>div[data-id='+filter+']>span[data-sub-id="'+sub_index+'"]');
	  element.remove();
	  act_filter_count -= 1;
  }
  // else add filter option
  else {
	  filters[filter].push(filter_option);
	  const sub_index = filter_values[filter][1].indexOf(filter_option);
	  const parent_div = document.querySelector('#eurohpc_selected_filters_block>div[data-id='+filter+']');
	  // and display list of active filter on the page
	  const active_filter = document.createElement('span');
	  active_filter.setAttribute('data-sub-id', sub_index);
	  active_filter.setAttribute('class', 'eurohpc_act_filter');
	  const act_filter_text = document.createTextNode(filter_option);
	  active_filter.append(act_filter_text);
	  const rm_button = document.createElement('span');
	  rm_button.setAttribute('data-sub-id', sub_index);
	  rm_button.classList.add('eurohpc_filter_rm_button');
	  rm_button.setAttribute('data-id', filter);
	  const rm_text = document.createTextNode(' x ');
	  rm_button.append(rm_text);
	  rm_button.addEventListener('click', function(e) {const filter=this.getAttribute('data-id'); const sub_id = this.getAttribute('data-sub-id'); const input = document.querySelector('section#eurohpc_filters>nav#eurohpc_filters_block>ul>li>ul#eurohpc_filter_'+filter+'>li>input#eurohpc_filter_'+filter+'_'+sub_id); input.click();});
	  active_filter.append(rm_button);
	  parent_div.append(active_filter);
	  act_filter_count += 1;
  }
  fltr_by_array(filter, filters[filter]);
  // If any filter has active options, display description of filter list
  if (act_filter_count > 0) {
  	document.querySelector('#eurohpc_selected_filters_block>div>span').setAttribute('style', 'visibility:visible');
  	document.querySelector('#eurohpc_selected_filters_block>div.head').setAttribute('class', 'head visible');
  }
  // else hide it.
  else {
	document.querySelector('#eurohpc_selected_filters_block>div>span').setAttribute('style', 'visibility:hidden');
  	document.querySelector('#eurohpc_selected_filters_block>div.visible').setAttribute('class', 'head');
  }
  // Hide/unhide events according to setting in meta data array
  set_hidden();
}

// Helper to remove array items
function removeArrayItem(item, array) {
	const index = array.indexOf(item);
	if (index > -1) {
		  array.splice(index, 1);
	}
}

hpc_event_timers = []

function fly_mouse_out_event(event, filter) {
    timer1 = setTimeout(function(event) {
    const opennav_list = document.querySelectorAll("section#eurohpc_filters>nav#eurohpc_filters_block>ul>li.eurohpc-has-submenu.open");
	    opennav_list.forEach(item => {
		    item.classList.remove("open");
		    item.querySelector('button').setAttribute('aria-expanded', "false");
	    }
	    );
  }, 00);
}

function fly_mouse_over_event(event) {
  // Change timers per filter!!
  //this.classList.add("open");
  if(typeof timer1 !== 'undefined'){ 
	  clearTimeout(timer1);
  }
}

// Add filters if filters are defined.
function add_filter_block() {
   if (filters_avail !== null && filters_avail.length > 0 && filters_avail[0] !== "") {
      const filter_template = `
   <nav id="eurohpc_filters_block" aria-label="Filter settings">
    <ul>
     <template id="eurohpc_filter_block_template">
     <li class="eurohpc-has-submenu">
       <button aria-haspopup="true" aria-expanded="false" href="#eurohpc_filters_block"></button>
       <ul id="eurohpc_filter_template_id" role="list">
       </ul>
      </li>
     </template>
    </ul>
   </nav>
   <div id="eurohpc_filter_block">
    <div id="eurohpc_selected_filters_block">
     <div class="head">
      <span style="visibility:hidden">Active filters</span>
     </div>
    </div>
   </div>
      `;
      // Add filter section
      var x = document.createElement("section");
      x.innerHTML = filter_template;
      x.setAttribute("id", "eurohpc_filters");
      x.setAttribute("class", "events-section eurohpc-filters");
      let pages_section = document.querySelector("#eurohpc-items-block")
      parent_element.insertBefore(x, pages_section);
      // Start appeding filters to filter's list
      const filters_list = document.querySelector('nav#eurohpc_filters_block>ul');
      filters_selected_block = document.getElementById('eurohpc_selected_filters_block');
      for(const filter of filters_avail) {
   	  // Add filter-div to selected filters block (div)
   	  const filter_selected_block = document.createElement('div');
   	  filter_selected_block.setAttribute('class', 'eurohpc-selected-filter');
   	  filter_selected_block.setAttribute('data-id', filter);
   	  filters_selected_block.append(filter_selected_block);
   	  // Add filter in filter list
   	  const filter_list_element = document.querySelector('#eurohpc_filter_block_template').content.cloneNode(true);
   	  const filter_list_element_li = filter_list_element.querySelector('li.eurohpc-has-submenu');
          filter_list_element_li.addEventListener('pointerout', fly_mouse_out_event);
          filter_list_element_li.addEventListener('pointerover', fly_mouse_over_event);
   	  const filter_options_button = filter_list_element.querySelector('li.eurohpc-has-submenu>button');
   	  filter_options_button.innerHTML = filter_values[filter][0];
	  filter_options_button.addEventListener('click', function(event) {let parent_nd = this.parentNode; if (parent_nd.classList.contains('open')) {parent_nd.classList.remove('open');} else{parent_nd.classList.add('open');}});
	  //filter_options_button.addEventListener('blur', function(event) {let parent_nd = this.parentNode; parent_nd.classList.remove('open');});
   	  const filter_options = filter_list_element.querySelector('ul');
   	  filter_options.setAttribute('id', 'eurohpc_filter_'+filter);
   	  // Add the filter's options to filter
   	  for (let sub_index = 0; sub_index < filter_values[filter][1].length; sub_index++) {
   		  // name of filter option
   		  const filter_option = filter_values[filter][1][sub_index];
   		  // Add list element for filter options
   		  const filter_option_element = document.createElement('li');
   		  const filter_option_checkbox = document.createElement('input');
   		  filter_option_checkbox.setAttribute('id', 'eurohpc_filter_'+filter+'_'+sub_index);
   		  filter_option_checkbox.setAttribute('type', 'checkbox');
   		  filter_option_checkbox.setAttribute('data-filter', filter);
   		  filter_option_checkbox.setAttribute('data-filter_option', filter_option);
   		  filter_option_checkbox.addEventListener('click', applyFilters);
   		  const filter_option_label = document.createElement('label');
   		  filter_option_label.setAttribute('for', 'eurohpc_filter_'+filter+'_'+sub_index);
   		  const label_text = document.createTextNode(filter_option);
   		  filter_option_label.append(label_text);
   		  filter_option_element.append(filter_option_checkbox);
   		  filter_option_element.append(filter_option_label);
   		  filter_options.append(filter_option_element);
   	  }
   	  filters_list.append(filter_list_element);
      }
   }
}

// callback for items-per-page-slider
function item_slider_callback(){
	let value = event.target.value;
	// scale by factor 1/2 and cut-off at 49
	nr_dspl_items = Number(value)===100 ? Infinity : Math.ceil(value/2); 
	dspl_offset=0;
	// change hidden elements
	set_hidden();
	// change slider label
	const slider_label = document.querySelector('section#eurohpc-items-block>div>div#per-page-block>label');
	if (nr_dspl_items > 1 && nr_dspl_items < Infinity) {slider_label.innerHTML = nr_dspl_items+" items per page";}
	if (nr_dspl_items === Infinity) {slider_label.innerHTML = "infinitely many items per page";}
	if (nr_dspl_items === 1) {slider_label.innerHTML = nr_dspl_items+" item per page";}
}

// Add items-per-page-block
var x = document.createElement("section");
x.setAttribute("id", "eurohpc-items-block");
x.setAttribute("class", "events-section items-block");
// define intial values for slider
let eurohpc_per_page_slider_initial = 2*nr_dspl_items<100 ? 2*nr_dspl_items : 100;
let eurohpc_per_page_slider_initial_label = `${nr_dspl_items} items per page`;
if (nr_dspl_items === Infinity) {eurohpc_per_page_slider_initial_label = "infinitely many items per page";}
if (nr_dspl_items === 1) {eurohpc_per_page_slider_initial_label = nr_dspl_items+" item per page";}
// HTML block
const pages_block_html = `
    <div class="">
	<div id="pages-block"></div>
	<div id="per-page-block"><input type="range" id="eurohpc-items-per-page-slider" min="1" value="${eurohpc_per_page_slider_initial}" onChange="item_slider_callback()" />
	<label for="eurohpc-items-per-page-slider">${eurohpc_per_page_slider_initial_label}</label></div>
    </div>
`;
x.innerHTML = pages_block_html;
parent_element.appendChild(x);

// Add our template section
x = document.createElement("section");
x.setAttribute("id", "events-section");
x.setAttribute("class", "events-section");
const template_html = `
    <ul id="eurohpc_events" class="hpc_event">
        <template id="eurohpc_event_template">
            <li id="list_id">
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
                        <button class="open-button" id="newtab_button" style="width: 15%;" aria-label="Open in new tab"><i class="fas fa-external-link-alt"></i></button>
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
