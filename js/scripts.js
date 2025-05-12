document.addEventListener('DOMContentLoaded', function() {
    // Initialize map if element exists
    const mapElement = document.getElementById('map');
    if (mapElement) {
        initializeMap();
    }

    // Initialize dashboard visualizations if they exist
    const kdeMapElement = document.getElementById('kde-map');
    if (kdeMapElement) {
        initializeDashboardVisualizations();
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('.nav-links a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.includes('#')) {
                e.preventDefault();
                const targetId = '#' + href.split('#')[1];
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                } else {
                    window.location.href = href;
                }
            }
        });
    });
});

function initializeMap() {
    const map = L.map('map').setView([28.7041, 77.1025], 5); // Default to India
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const cities = [
        { name: "Visakhapatnam", coords: [17.6868, 83.2185] },
        { name: "Vijayawada", coords: [16.5062, 80.6480] },
        { name: "Tirupati", coords: [13.6288, 79.4192] }
    ];

    cities.forEach(function(city) {
        L.marker(city.coords)
            .bindPopup(`<b>${city.name}</b>`)
            .addTo(map);
    });
}

function initializeDashboardVisualizations() {
    const serverDataElement = document.getElementById('server-data');
    let serverResults = null;
    if (serverDataElement) {
        try {
            serverResults = JSON.parse(serverDataElement.textContent || 'null');
        } catch (e) {
            console.error('Error parsing server data:', e);
        }
    }

    const crimeTypesElement = document.getElementById('crime-types');
    let crimeTypes = ['THEFT', 'ASSAULT', 'ROBBERY', 'OTHER']; // Default
    if (crimeTypesElement) {
        try {
            crimeTypes = JSON.parse(crimeTypesElement.textContent) || crimeTypes;
        } catch (e) {
            console.error('Error parsing crime types:', e);
        }
    }

    // Initialize or update KDE map
    let kdeMap = window.kdeMap; // Check if map exists in global scope
    const kdeMapElement = document.getElementById('kde-map');
    if (!kdeMap && kdeMapElement) {
        kdeMap = L.map('kde-map').setView([28.7041, 77.1025], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(kdeMap);
        window.kdeMap = kdeMap; // Store map in global scope to reuse
    } else if (kdeMap) {
        kdeMap.eachLayer(layer => {
            if (layer instanceof L.TileLayer) return; // Keep tile layer
            kdeMap.removeLayer(layer); // Remove markers or other overlays
        });
        kdeMap.invalidateSize(); // Refresh map size
    }

    if (serverResults && serverResults.kde && serverResults.input_features) {
        const lat = parseFloat(serverResults.input_features.Latitude);
        const lng = parseFloat(serverResults.input_features.Longitude);
        kdeMap.setView([lat, lng], 12);

        L.circleMarker([lat, lng], {
            radius: Math.max(5, serverResults.kde.intensity * 15),
            fillColor: '#ff7846',
            color: '#ff6347',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(kdeMap)
        .bindPopup(`Hotspot Intensity: ${(serverResults.kde.intensity * 100).toFixed(1)}%`)
        .openPopup();
    }

    // Initialize SVM Chart
    const svmChartElement = document.getElementById('svm-chart');
    if (svmChartElement && serverResults && serverResults.svm) {
        const ctx = svmChartElement.getContext('2d');
        const highRisk = serverResults.svm.high_risk * 100;
        const lowRisk = (1 - serverResults.svm.high_risk) * 100;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Low Risk', 'High Risk'],
                datasets: [{
                    data: [lowRisk, highRisk],
                    backgroundColor: ['#4CAF50', '#F44336']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Initialize Poisson Chart
    const poissonChartElement = document.getElementById('poisson-chart');
    if (poissonChartElement && serverResults && serverResults.poisson) {
        const ctx = poissonChartElement.getContext('2d');
        const predictionValue = serverResults.poisson.prediction || 1;

        const forecastData = Array(12).fill(predictionValue);
        forecastData[1] *= 1.1;
        forecastData[2] *= 1.2;
        forecastData[3] *= 0.9;
        forecastData[5] *= 1.3;
        forecastData[8] *= 0.7;
        forecastData[11] *= 1.1;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Predicted Crimes',
                    data: forecastData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // Initialize K-means Chart
    const kmeansChartElement = document.getElementById('kmeans-chart');
    if (kmeansChartElement && serverResults && serverResults.kmeans) {
        const ctx = kmeansChartElement.getContext('2d');
        let clusterDist = serverResults.kmeans.crime_distribution;
        console.log('K-Means cluster:', serverResults.kmeans.cluster);
        console.log('K-Means distribution:', clusterDist);

        if (!Array.isArray(clusterDist) || clusterDist.length === 0) {
            console.warn('Invalid K-Means distribution, using default');
            clusterDist = Array(crimeTypes.length).fill(1.0 / crimeTypes.length);
        }

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: crimeTypes,
                datasets: [{
                    data: clusterDist,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(201, 203, 207, 0.7)',
                        'rgba(255, 99, 71, 0.7)',
                        'rgba(144, 238, 144, 0.7)'
                    ].slice(0, crimeTypes.length),
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(201, 203, 207, 1)',
                        'rgba(255, 99, 71, 1)',
                        'rgba(144, 238, 144, 1)'
                    ].slice(0, crimeTypes.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                return `${tooltipItem.label}: ${(tooltipItem.raw * 100).toFixed(2)}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Export handlers
    window.exportPDF = function() {
        alert('PDF export functionality needs implementation');
    };

    window.exportCSV = function() {
        if (serverResults) {
            const csvContent = `data:text/csv;charset=utf-8,
                Prediction Type,Value
                Crime Count,${serverResults.poisson.prediction}
                Hotspot Intensity,${serverResults.kde.intensity}
                Risk Probability,${serverResults.svm.high_risk}
            `;
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'prediction_data.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('No data to export');
        }
    };
}