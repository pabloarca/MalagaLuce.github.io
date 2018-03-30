'use strict;'
if (!mapboxgl.supported()) {
  alert('Your browser does not support Mapbox GL. This app supports Safari 9 and above, Microsoft Edge 13 and above, along with the latest version of Chrome and Firefox');
}
else {
  mapboxgl.accessToken = 'pk.eyJ1IjoicGVwaXRvLWdyaWxsbyIsImEiOiJjajhhdjFjN3MwZ2Y2MnFwaWlkNmtoY2Y0In0.HJNKwaFRS8_ikTesrLtVsg';
  var filterGroup = document.getElementById('filter-group');
  const center_point = [-4.421482086181641, 36.72120508210904],
        bounds = [
            [-4.514179229736328,
            36.67667990169817],
            [-4.3526458740234375,
            36.75043865214185]
        ]
        url = "./data.geojson",
        map = new mapboxgl.Map({
          container: 'map', // container id
          style: 'mapbox://styles/mapbox/streets-v10', // stylesheet location
          center: center_point, // starting position [lng, lat]
          maxBounds: bounds,
          zoom: 10,
          maxzoom: 18,
          minzoom: 10
        }),
        navigation = new mapboxgl.NavigationControl(),
        geolocate = new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true
        }),
        geocoder = new MapboxGeocoder({
          accessToken: mapboxgl.accessToken,
          /*
          Limit the results to Spain
          */
          country: 'es',
          /*
          Apply the same bbox to the geocoder to limit results to this area
          */
          bbox: bounds.reduce(
            ( accumulator, currentValue ) => accumulator.concat(currentValue),[]
          )
        });

  /*
  Initialize the map controls
  */
  map.addControl(navigation);
  map.addControl(geolocate);
  map.addControl(geocoder, 'top-left');

  /*
  Initilize the map
  */
  map.on('load', function () {
    /*
    Fit view to bbox
    */
    map.fitBounds(bounds);
    /*
    Add all the sources to the map.
    */
    map.addSource('poa',{
      type: 'geojson',
      data: url
    });

    map.addLayer({
        "id": "action-points",
        "type": "circle",
        "source": "poa",
        "minzoom": 14,
        "paint": {
            /*
            Size circle radius by zoom level using the aproximation:
            S = R * cos(lat) / (z+8), where:
            - R: Equatorial radius of Earth
            - lat: latitude (in degrees) of the location
            - z: zoom level
            */
            "circle-radius": [
                "interpolate",
                ["exponential",2],
                ["zoom"],
                 14, 3.5,
                 22,840
            ],
            /*
            Color circle by team
            */
            "circle-blur": 0.25,
            "circle-color": ["to-color",
              ["get", "color",["at", 0,["get", "teams", ["at", 0,["get", "volunteers"]]]]]
            ],
            /*
            Transition from heatmap to circle layer by zoom level.
            */
            "circle-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14, 0,
                15, 1
            ]
        }
    }, 'waterway-label');

    /*
    We add a dummy layer, not visible, to hold all data (because Mapbox only let
    us retrieve data from a layer represented on a map)
    */
    map.addLayer({
      'id': 'data-layer',
      'source': 'poa',
      'type': 'circle',
      'paint': {
        'circle-opacity': 0
      }
    })

    map.once('click', () => {
      /*
      We will store all teams names to dinamically set the map.
      */
      let teams = [] ;
      let team_cache = new Set();
      map.querySourceFeatures('poa')
      .forEach(feature => {
        let team = {}
        feature['properties']['volunteers']
        .split('}]')[0].split(':[{')[1]
        .split(',')
        .filter(field => field.includes('color') || field.includes('name'))
        .map(feature => (feature.includes('color') ? team['color'] = feature.split(':')[1].slice(1).slice(0,-1) : team['name'] = feature.split(':')[1].slice(1).slice(0,-1)));
        teams.push(team);
      });

      teams.forEach(team => {
        map.addLayer({
          "id": team['name'] +'-heat',
          "type": "heatmap",
          "source": "poa",
          'filter': ['==',team['name'],["get", "name",["at", 0,["get", "teams", ["at", 0,["get", "volunteers"]]]]]],
          "maxzoom": 15,
          "paint": {
            /*
            Set the heatmap weight
            */
            "heatmap-weight": 1,
            /*
            Increase the heatmap-color weight by zoom level. Heatmap-intensity
            is a multiplier on top of heatmap-weight
            */
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 1,
              13, 3
            ],
            /*
            Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
            Begin color ramp at 0-stop with a 0-transparancy color
            to create a blur-like effect.
            */
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(33,102,172,0)",
              0.2, "rgb(103,169,207)",
              0.4, "rgb(209,229,240)",
              0.6, "rgb(253,219,199)",
              0.8, "rgb(239,138,98)",
              1, team['color']
            ],
            /*
            Adjust the heatmap radius by zoom level
            */
            "heatmap-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              12, 14,
              14, 47
            ],
            /*
            Transition from heatmap to circle layer by zoom level
            */
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 1,
              15, 0
            ],
          }
        }, 'waterway-label');
      });
      map.removeLayer('data-layer');
    });

    // Add checkbox and label elements for the layer.
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'action-points';
    input.checked = true;
    filterGroup.appendChild(input);

    var label = document.createElement('label');
    label.setAttribute('for', 'action-points');
    label.textContent = 'layer';
    filterGroup.appendChild(label);


    map.on('click', 'action-points', e => {
      let properties = e['features'][0]['properties'],
          geometry = e['features'][0]['geometry']
          html = `<h3>${ properties['id'] ? properties['id'] : properties['use']}</h3>
               ${properties['ocupation'] ? '<span>Ocupación del parking <meter low="50" high="75" max="100" value="80"></meter></span>' : ''}`;

      map.flyTo({
        center: geometry['coordinates'],
        speed: 0.4,
        zoom: 18,
        curve: 1
      });

      new mapboxgl.Popup()
      .setLngLat(geometry['coordinates'])
      .setHTML(html)
      .addTo(map);
    });

    /*
    When the checkbox changes, update the visibility of the layer.
    */
    input.addEventListener('change', function(e) {
        if (e.target.checked) {
          map.setFilter('action-points', ["==","TeamName",["get", "name",["at", 0,["get", "teams", ["at", 0,["get", "volunteers"]]]]]]);
        }
        else {
          map.setFilter('action-points', null);
        }
    });

    /*
    Change the cursor to a pointer when the it hovers the location layer
    */
    map.on('mouseenter', 'action-points', () => {
      map.getCanvas().style.cursor = 'pointer'
    });

    /*
    Change it back to a pointer when it leaves.
    */
    map.on('mouseleave', 'action-points', () => {
      map.getCanvas().style.cursor = ''
    });
  });
};
