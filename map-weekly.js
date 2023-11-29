const getRandomAQIColor = (aqi) => {
    const colorScale = d3.scaleSequential(d3.interpolateRgbBasis(['green', 'yellow', 'orange', 'red', 'purple'])).domain([0, 100]);
    return d3.rgb(colorScale(aqi));
};
let selectedLocation = 'dtla';
let intervals;
let selectedStartDate;
let selectedEndDate;
let selectedSensor = '3rd and Broadway';
let locationsData;
let avgAqiByLocationAndSensor;
let map;
let allTimeSeriesData = [];
const markers = [];
let selectedIndex = 0;
function createFixedIntervals(data, intervalSize) {
    const intervals = [];
    console.log(data.length / 6);
    for (let i = 0; i < data.length / 6; i += intervalSize) {
        const start = i;
        const end = Math.min(i + intervalSize - 1, data.length / 6 - 1);
        intervals.push({ start, end });
    }
    return intervals;
}
d3.csv("dataset/coordinates.csv").then(coordData => {
    map = L.map('map').setView([34.0194, -118.4912], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    
    // Default location

    // Function to display information for the default location
    
    Promise.all(coordData.map(coord => loadData(coord))).then(locationsData => {
        allTimeSeriesData = [].concat(...locationsData);
        allTimeSeriesData.sort((a, b) => a.dateTime - b.dateTime);
        console.log(allTimeSeriesData);
        num_of_locations = 6;
        // Calculate fixed 7-day intervals
        intervals = createFixedIntervals(allTimeSeriesData, 7);
        console.log(intervals);
        // Calculate possible start dates for the slider based on 7-day intervals
        const possibleStartDates = intervals.map(interval => allTimeSeriesData[interval.start * num_of_locations].dateTime);
        console.log(possibleStartDates);
        // Set the selected start date to the first one
        selectedStartDate = possibleStartDates[0];
        
        selectedEndDate = new Date(selectedStartDate);
        selectedEndDate.setDate(selectedEndDate.getDate() + 6);
        console.log('end date',selectedEndDate);
        console.log('locationsData:', locationsData);
        Promise.resolve().then(() => {
            updateMap(selectedStartDate, locationsData, selectedLocation, selectedSensor);
            displayLocationInfo(locationsData.map(data => `${data[0].location}_${data[0].sensorName}`), selectedStartDate, selectedEndDate, avgAqiByLocationAndSensor, selectedSensor);
        });

        allTimeSeriesData.forEach(data => {
            const color = getRandomAQIColor(data.aqi);
            const marker = L.circleMarker([data.latitude, data.longitude], {
                radius: 13,
                fillColor: color,
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            }).addTo(map);

            marker.bindPopup(`Location: ${data.location}<br>Sensor: ${data.sensorName}<br>Date: ${data.dateTime.toLocaleString()}<br>AQI: ${data.aqi}`).on('click', function (e) {
                selectedLocation = data.location;
                selectedSensor = data.sensorName;
                displayLocationInfo(locationsData.map(data => `${data[0].location}_${data[0].sensorName}`), selectedStartDate, selectedEndDate, avgAqiByLocationAndSensor, selectedSensor);// Update information on marker click
            });

            markers.push(marker);
        });
        $("#slider").slider({
            range: "min",
            value: 0,
            min: 0,
            max: possibleStartDates.length - 1,
            slide: function (event, ui) {
                selectedIndex = ui.value;
                selectedStartDate = possibleStartDates[ui.value];
                selectedEndDate = new Date(selectedStartDate);
                selectedEndDate.setDate(selectedEndDate.getDate() + 6);
                updateMap(selectedStartDate, locationsData, selectedLocation, selectedSensor);
                displayLocationInfo(locationsData.map(data => `${data[0].location}_${data[0].sensorName}`), selectedStartDate, selectedEndDate, avgAqiByLocationAndSensor, selectedSensor);
            },
        });

        showDefaultInfo();
        // Show information for the default location on page load
        displayLocationInfo(locationsData.map(data => `${data[0].location}_${data[0].sensorName}`), selectedStartDate, selectedEndDate, avgAqiByLocationAndSensor, selectedSensor);
    });

    function loadData(coord) {
        return new Promise((resolve) => {
            d3.csv(`dataset/${coord.Location.toLowerCase()}.csv`).then(data => {
                const filteredData = data.filter(entry => entry.DateTime && entry[coord.SensorName]);
                const timeSeriesData = filteredData.map(entry => {
                    const dateTime = parseDateTime(entry.DateTime);
                    const aqi = parseFloat(entry[coord.SensorName]);
                    const sensorName = coord.SensorName;
                    return {
                        location: coord.Location,
                        sensorName,
                        dateTime,
                        latitude: coord.Latitude,
                        longitude: coord.Longitude,
                        aqi
                    };
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

    
});
function updateMap(selectedStartDate, locationsData, selectedLocation, selectedSensor) {
    markers.forEach(marker => marker.remove());
    markers.length = 0;

    const selectedEndDate = new Date(selectedStartDate);
    selectedEndDate.setDate(selectedEndDate.getDate() + 6);
    console.log('selected end date',selectedEndDate);
    const selectedWeekData = allTimeSeriesData.filter(data => data.dateTime >= selectedStartDate && data.dateTime <= selectedEndDate);
    avgAqiByLocationAndSensor = calculateAverageAqiByLocationAndSensor(selectedWeekData);

    selectedWeekData.forEach(data => {
        const key = `${data.location}_${data.sensorName}`;
        const color = getRandomAQIColor(avgAqiByLocationAndSensor[key]);
        const marker = L.circleMarker([data.latitude, data.longitude], {
            radius: 13,
            fillColor: color,
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(map);

        marker.bindPopup(`Location: ${data.location}<br>Sensor: ${data.sensorName}<br>Date: ${selectedStartDate.toLocaleDateString()}-${selectedEndDate.toLocaleDateString() }<br>AQI: ${avgAqiByLocationAndSensor[key]}`).on('click', function (e) {
            selectedLocation = data.location;
            selectedSensor = data.sensorName;
            displayLocationInfo(locationsData.map(data => `${data[0].location}_${data[0].sensorName}`), selectedStartDate, selectedEndDate, avgAqiByLocationAndSensor, selectedSensor);
        });

        markers.push(marker);
    });
}
function calculateAverageAqiByLocationAndSensor(data) {
    const avgAqiByLocationAndSensor = {};
    const locationSensorCounts = {};

    data.forEach(entry => {
        const key = `${entry.location}_${entry.sensorName}`;

        if (!(key in avgAqiByLocationAndSensor)) {
            avgAqiByLocationAndSensor[key] = 0;
            locationSensorCounts[key] = 0;
        }

        avgAqiByLocationAndSensor[key] += entry.aqi;
        locationSensorCounts[key]++;
    });

    // Calculate average for each location and sensor name combination
    Object.keys(avgAqiByLocationAndSensor).forEach(key => {
        if (locationSensorCounts[key] > 0) {
            avgAqiByLocationAndSensor[key] /= locationSensorCounts[key];
        }
    });

    return avgAqiByLocationAndSensor;
}
function showDefaultInfo() {
    updateMap(selectedStartDate, locationsData, selectedLocation, selectedSensor);
    // const defaultInfo = locationsData.filter(data => data.location === selectedLocation && data.dateTime === selectedStartDate);
  
}
function displayLocationInfo(locationSensorKeys, startDate, endDate, avgAqiByLocationAndSensor, selectedSensor) {
    const infoBox = document.getElementById('info-box');
    const locationInfo = document.getElementById('location-info');

    if (allTimeSeriesData.length === 0) {
        infoBox.style.display = 'none';
        return;
    }

    let infoText = '';

    // Filter locationSensorKeys to show information only for the selected sensor
    const filteredKeys = locationSensorKeys.filter(key => key.endsWith(`_${selectedSensor}`));

    filteredKeys.forEach(key => {
        const avgAqi = avgAqiByLocationAndSensor[key];
        if (avgAqi !== undefined) {
            const [location, sensorName] = key.split('_');
            /// here is the information to be used by small multiples
            infoText += `Location: ${location}<br>Sensor: ${sensorName}<br>Week: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}<br>Avg AQI: ${avgAqi.toFixed(2)}<br><br>`;
        }
    });

    locationInfo.innerHTML = infoText;
    infoBox.style.display = 'block';
}
