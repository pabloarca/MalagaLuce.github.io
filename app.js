'use strict;'
if (!mapboxgl.supported()) {
  alert('Your browser does not support Mapbox GL. This app supports Safari 9 and above, Microsoft Edge 13 and above, along with the latest version of Chrome and Firefox');
}
else {
  mapboxgl.accessToken = 'pk.eyJ1IjoicGVwaXRvLWdyaWxsbyIsImEiOiJjajhhdjFjN3MwZ2Y2MnFwaWlkNmtoY2Y0In0.HJNKwaFRS8_ikTesrLtVsg';
  const center_point = [-4.421482086181641, 36.72120508210904],
        bounds = [
            [-4.514179229736328,
            36.67667990169817],
            [-4.3526458740234375,
            36.75043865214185]
        ]
        url = "data.geojson",
        map = new mapboxgl.Map({
          container: 'map', // container id
          style: 'mapbox://styles/mapbox/streets-v10', // stylesheet location
          center: center_point, // starting position [lng, lat]
          maxBounds: bounds,
          zoom: 11,
          maxzoom: 18,
          minzoom: 11
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
          bbox: bounds
        });
        fullscreen = new mapboxgl.FullscreenControl();

  /*
  Initialize the map controls
  */
  map.addControl(navigation);
  map.addControl(geolocate);
  map.addControl(fullscreen, 'bottom-right');
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

    /*
    We make use of the filters provided by mapbox to construct the different
    layers.
    */
    map.addLayer({
      "id": "action-heat",
      "type": "heatmap",
      "source": "poa",
      "maxzoom": 15,
      "paint": {
        /*
        Set the heatmap weight
        */
        "heatmap-weight": 1,
        /*
        Increase the heatmap color weight weight by zoom level heatmap-intensity
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
          1, "rgb(178,24,43)"
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

    map.addLayer({
        "id": "action-points",
        "type": "circle",
        "source": "poa",
        "minzoom": 14,
        "paint": {
            /*
            Size circle radius by zoom level. It is an area of roughly 10m,
            adjusted by zoom level using the aproximation
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
            "circle-color": ["to-color",
              ["get", "color",["at", 0,["get", "teams", ["at", 0,["get", "volunteers"]]]]]
            ],
            // "circle-stroke-color": "white",
            // "circle-stroke-width": 2,
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

    map.on('click', 'action-points', e => {
      let properties = e['features'][0]['properties'],
          geometry = e['features'][0]['geometry']
          html = `'<span>si<meter low="50" high="75" max="100" value="80"></meter></span>' : 'yes'}`;

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
