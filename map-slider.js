const getRandomAQIColor = (aqi) => {
    const colorScale = d3.scaleSequential(d3.interpolateRgbBasis(['green', 'yellow', 'red'])).domain([0, 100]);
    return d3.rgb(colorScale(aqi));
};

d3.csv("dataset/coordinates.csv").then(coordData => {

    const map = L.map('map').setView([34.0194, -118.4912], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const markers = [];
    let allTimeSeriesData = []; 

    
    Promise.all(coordData.map(coord => loadData(coord))).then(locationsData => {
        
        allTimeSeriesData = [].concat(...locationsData);

        
        $("#slider").slider({
            range: "min",
            value: 0,
            min: 0,
            max: locationsData.reduce((max, locData) => Math.max(max, locData.length - 1), 0),
            slide: function (event, ui) {
                updateMap(ui.value, locationsData);
            }
        });

        allTimeSeriesData.forEach(data => {
            const color = getRandomAQIColor(data.aqi);
            const marker = L.circleMarker([data.latitude, data.longitude], {
                radius: 10,
                fillColor: color,
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            }).addTo(map);

            marker.bindPopup(`Location: ${data.location}<br>Date: ${data.dateTime.toLocaleString()}<br>AQI: ${data.aqi}`).openPopup();
            markers.push(marker);
        });

        updateMap(0, locationsData);
    });

    function loadData(coord) {
        return new Promise((resolve) => {
            d3.csv(`dataset/${coord.Location.toLowerCase()}.csv`).then(data => {
    
                const filteredData = data.filter(entry => entry.DateTime && entry[coord.SensorName]);
    
                const timeSeriesData = filteredData.map(entry => {
                    const dateTime = parseDateTime(entry.DateTime);
                    const aqi = parseFloat(entry[coord.SensorName]);
    
                    return { location: coord.Location, dateTime, latitude: coord.Latitude, longitude: coord.Longitude, aqi };
                });
                resolve(timeSeriesData);
            });
        });
    }

    function parseDateTime(dateTimeString) {
        if (!dateTimeString) {
            return null;
        }

        const [datePart, timePart] = dateTimeString.split(' ');

        if (!datePart || !timePart) {
            return null;
        }

        const [month, day, year] = datePart.split('/');
        const [hours, minutes] = timePart.split(':');

        return new Date(`20${year}`, month - 1, day, hours, minutes);
    }

    function updateMap(selectedIndex, locationsData) {
        if (selectedIndex >= 0 && selectedIndex < allTimeSeriesData.length) {
            markers.forEach(marker => marker.remove());
            markers.length = 0;
    
            const selectedDate = allTimeSeriesData[selectedIndex].dateTime;
    
            locationsData.forEach(locationData => {
                const dataForDate = locationData.find(data => data.dateTime && data.dateTime.getTime() === selectedDate.getTime());
    
                
                if (dataForDate) {
                    const color = getRandomAQIColor(dataForDate.aqi);
                    const marker = L.circleMarker([dataForDate.latitude, dataForDate.longitude], {
                        radius: 10,
                        fillColor: color,
                        color: 'white',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.7
                    }).addTo(map);
    
                    marker.bindPopup(`Location: ${dataForDate.location}<br>Date: ${dataForDate.dateTime.toLocaleString()}<br>AQI: ${dataForDate.aqi}`).openPopup();
                    markers.push(marker);
                }
            });
        }
    }
    
    
    
});
