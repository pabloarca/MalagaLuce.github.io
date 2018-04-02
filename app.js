'use strict;'
if (!mapboxgl.supported()) {
  alert('Your browser does not support Mapbox GL. This app supports Safari 9 and above, Microsoft Edge 13 and above, along with the latest version of Chrome and Firefox');
}
else {
  mapboxgl.accessToken = 'pk.eyJ1IjoicGVwaXRvLWdyaWxsbyIsImEiOiJjajhhdjFjN3MwZ2Y2MnFwaWlkNmtoY2Y0In0.HJNKwaFRS8_ikTesrLtVsg';
  const filterGroup = document.getElementById('filter-group'),
        time_slider = document.getElementById('time-slider'),
        time_label = document.getElementById('time-label'),
        time_steps = [Infinity,90,30,7,1],
        center_point = [-4.421482086181641, 36.72120508210904],
        bounds = [
            [-4.514179229736328,
            36.67667990169817],
            [-4.3526458740234375,
            36.75043865214185]
        ],
        url = 'data.geojson',
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
        /*
        geolocate = new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true
        }),
        */
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
  // map.addControl(geolocate);
  map.addControl(geocoder, 'top-left');

  /*
  Set the locale for time
  */
  moment.locale('es');
  /*
  Initilize the map
  */
  map.on('load', function () {
    /*
    We will store all teams names to dinamically set the map.
    */
    let teams = [];
    let teams_cache = new Set();
    /*
    Adjust slider max setting
    */
    time_slider.setAttribute('max', parseInt(time_steps.length - 1))
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
        'id': 'action-points',
        'type': 'circle',
        'source': 'poa',
        'minzoom': 14,
        'filter': ['all'],
        'paint': {
            /*
            Size circle radius by zoom level using the aproximation:
            S = R * cos(lat) / (z+8), where:
            - R: Equatorial radius of Earth
            - lat: latitude (in degrees) of the location
            - z: zoom level
            */
            'circle-radius': [
                'interpolate',
                ['exponential',2],
                ['zoom'],
                 14, 3.5,
                 22,840
            ],
            /*
            Color circle by team
            */
            'circle-blur': 0.1,
            'circle-color': ['to-color',
              ['get', 'color',['at', 0,['get', 'teams', ['at', 0,['get', 'volunteers']]]]]
            ],
            /*
            Transition from heatmap to circle layer by zoom level.
            */
            'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, 0,
                15, 1
            ]
        }
    });

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
      map.querySourceFeatures('poa')
      .forEach(feature => {
        let team = {};
        feature['properties']['volunteers']
        .split('}]')[0]
        .split(':[{')[1]
        .split(',')
        .filter(field => field.includes('color') || field.includes('name') || field.includes('emblem'))
        .map(feature => feature.split(':')[1].slice(1,-1))
        .map(feature => {
          if (feature.includes('#')) {
            team['color'] = feature
          }
          else if (feature.includes('/')) {
            team['emblem'] = feature
          }
          else {
            team['name'] = feature
          }
        });
        (teams_cache.has(team['name']) ? '' : teams.push(team));
        teams_cache.add(team['name']);
      });

      teams.forEach(team => {
        map.addLayer({
          'id': team['name'] +'-heat',
          'type': 'heatmap',
          'source': 'poa',
          'filter': ['all', ['==',team['name'],['get', 'name',['at', 0,['get', 'teams', ['at', 0,['get', 'volunteers']]]]]]],
          'maxzoom': 15,
          'paint': {
            /*
            Set the heatmap weight
            */
            'heatmap-weight': 1,
            /*
            Increase the heatmap-color weight by zoom level. Heatmap-intensity
            is a multiplier on top of heatmap-weight
            */
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              13, 3
            ],
            /*
            Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
            Begin color ramp at 0-stop with a 0-transparancy color
            to create a blur-like effect.
            */
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgba(103,169,207,0.25)',
              0.4, 'rgba(209,229,240,0.25)',
              0.6, 'rgba(253,219,199,0.25)',
              0.8, 'rgba(239,138,98,0.25)',
              1, team['color']
            ],
            /*
            Adjust the heatmap radius by zoom level
            */
            'heatmap-radius': [
              'interpolate',
              ['exponential', 2],
              ['zoom'],
              12, 14,
              14, 47
            ],
            /*
            Transition from heatmap to circle layer by zoom level
            */
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14, 1,
              15, 0
            ],
          }
        });

        /*
        Selector checkbox for visible layers
        */
        let node = document.createElement('li');
        let input = document.createElement('input');
        input.type = 'checkbox';
        input.id = team['name'];
        input.checked = true;
        node.appendChild(input);

        let label = document.createElement('label');
        label.setAttribute('for', team['name']);
        label.textContent = team['name'];
        node.appendChild(label);
        filterGroup.appendChild(node)

        /*
        Add listeners to the checkboxes
        */
        input.addEventListener('change', function(e) {
          let layer_filter = map.getFilter('action-points');
          if (e.target.checked) {
            map.setFilter('action-points', layer_filter.filter(filter => filter.includes(e['target']['id']) == false));
            map.setLayoutProperty(e['target']['id'] + '-heat', 'visibility', 'visible');
          }
          else {
            layer_filter.push(['!=',e['target']['id'],['get', 'name',['at', 0,['get', 'teams', ['at', 0,['get', 'volunteers']]]]]]);
            map.setFilter('action-points', layer_filter);
            map.setLayoutProperty(e['target']['id'] + '-heat', 'visibility', 'none');
          }
        });

        /*
        Add listener to the slider
        */
        time_slider.addEventListener('input', e => {
          let layer_filter = map.getFilter('action-points').filter(filter => filter.includes('>=') == false);
          if (time_steps[e['target']['value']] < Infinity) {
            let date_point = moment()
                .subtract(time_steps[e['target']['value']], 'days')
                .toArray()
                .slice(0,3);
            layer_filter.push(['>=', ['to-number',['at', 0,['get','finishedDate']]], date_point[0]]);
            layer_filter.push(['>=', ['to-number',['at', 1,['get','finishedDate']]], date_point[1] + 1]);
            layer_filter.push(['>=', ['to-number',['at', 2,['get','finishedDate']]], date_point[2]]);
            map.setFilter('action-points', layer_filter);
            time_label.textContent = 'Realizadas ' + moment(moment().subtract(time_steps[e['target']['value']], 'days')).fromNow();

            teams.forEach(team => {
              let layer_filter_heatmap = map.getFilter(team['name'] + '-heat').filter(filter => filter.includes('>=') == false);
              layer_filter_heatmap.push(['>=', ['to-number',['at', 0,['get','finishedDate']]], date_point[0]]);
              layer_filter_heatmap.push(['>=', ['to-number',['at', 1,['get','finishedDate']]], date_point[1] + 1]);
              layer_filter_heatmap.push(['>=', ['to-number',['at', 2,['get','finishedDate']]], date_point[2]]);
              map.setFilter(team['name'] + '-heat', layer_filter_heatmap)
            });
          }
          else {
            map.setFilter('action-points', layer_filter);
            teams.forEach(team => {
              let layer_filter_heatmap = map.getFilter(team['name'] + '-heat').filter(filter => filter.includes('>=') == false);
              map.setFilter(team['name'] + '-heat', layer_filter_heatmap)
            });
            time_label.textContent = 'Todas las acciones'
          }
        });

      });
      map.removeLayer('data-layer');
    });

    map.on('click', 'action-points', e => {
      let properties = e['features'][0]['properties'],
          geometry = e['features'][0]['geometry'],
          emblem_path = properties['volunteers'].split(',')
            .filter(property => property.includes('emblem'))[0]
            .split(':')[1].slice(1,-1),
          volunteers_group = Array.from(new Set(properties['volunteers']
            .replace(/,"teams":\[\{["A-Za-z:\d,#/]*[\}]]/g, '').split(',')
            .filter(volunteer => volunteer.includes('name'))
            .map(volunteer => volunteer.split(':')[1].slice(1,-1))));
          html = `
            <img class="popup__emblem" src="${emblem_path}">
            <h3>Realizado ${moment(properties['finishedDate'].slice(1,-1).replace(/"/g,'').split(',').join('-')).from(moment())}</h3>
            <div class="popup__images">
            ${properties['creationPic'] ? '<a href=' + properties['creationPic'] + ' target="_blank"><figure><img class="popup__pic" src=' + properties['creationPic'] + '><figcaption>Antes</figcaption></figure></a>' : ''}
            ${properties['finishedPic'] ? '<a href=' + properties['finishedPic'] + ' target="_blank"><figure><img class="popup__pic" src=' + properties['finishedPic'] + '><figcaption>Antes</figcaption></figure></a>' : ''}
            </div>
            <h3 class="user">Participantes:</h3>
            <ul class="popup__list">${volunteers_group.map(volunteer => '<li class="popup__list-element">' + volunteer + '</li>').join('')}<ul>`;
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
    Change the cursor to a pointer when it hovers the location layer
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
