// js/dashboard.js
class ParkingDashboard {
    constructor() {
        this.chart = null;
        this.timeframe = 'daily';
        this.containerDiv = document.getElementById('dashboard-container');
        this.loadingDiv = document.getElementById('dashboard-loading');
        this.apiEndpoint = 'https://9nilem7pc1.execute-api.us-east-1.amazonaws.com/prod/dashboard';
        this.init();
    }

    getCurrentDate() {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    }

    async init() {
        try {
            this.setupEventListeners();
            await this.createChart();
            
            // Set daily as active by default
            document.getElementById('dailyDashboard').classList.add('btn-primary');
            document.getElementById('dailyDashboard').classList.remove('btn-outline-primary');
            
            await this.loadDashboardData();
        } catch (error) {
            this.showError('Failed to initialize dashboard');
            console.error('Initialization error:', error);
        }
    }

    showError(message) {
        document.getElementById('chartError').innerHTML = `
            <div class="alert alert-danger">
                ${message}
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="location.reload()">Reload</button>
            </div>
        `;
        document.getElementById('chartError').style.display = 'block';
    }

    setupEventListeners() {
        ['daily', 'weekly'].forEach(period => {
            document.getElementById(`${period}Dashboard`).addEventListener('click', async () => {
                try {
                    this.timeframe = period;
                    this.updateButtonStates(period);
                    await this.loadDashboardData();
                } catch (error) {
                    this.showError('Failed to load dashboard data');
                    console.error('Loading error:', error);
                }
            });
        });
    }

    updateButtonStates(activePeriod) {
        ['daily', 'weekly'].forEach(period => {
            const btn = document.getElementById(`${period}Dashboard`);
            if (period === activePeriod) {
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-outline-primary');
            } else {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline-primary');
            }
        });
    }

    showLoading() {
        this.loadingDiv.style.display = 'block';
        this.containerDiv.style.display = 'none';
        document.getElementById('chartError').style.display = 'none';
    }

    hideLoading() {
        this.loadingDiv.style.display = 'none';
        this.containerDiv.style.display = 'block';
    }

    updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        };
        document.getElementById('currentDate').textContent = 
            `Current Time: ${now.toLocaleString('en-US', options)}`;
    }

    async createChart() {
        const ctx = document.getElementById('dashboardCanvas').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Average Occupancy Rate',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Parking Occupancy - Daily View',
                        font: {
                            size: 16
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Occupancy Rate (%)',
                            font: {
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: value => `${value}%`
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day',
                            font: {
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }

    async loadDashboardData() {
        try {
            this.showLoading();
            this.updateDateTime();
    
            const url = `${this.apiEndpoint}?timeframe=${this.timeframe}`;
            console.log('Calling API with URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch dashboard data');
            }
            
            const responseData = await response.json();
            console.log('Raw API Response:', responseData);
    
            const parsedData = JSON.parse(responseData.body);
            console.log('Parsed response:', parsedData);
    
            // Update chart with API data
            this.chart.data.labels = parsedData.labels;  // Use API labels
            this.chart.data.datasets[0].data = parsedData.data;
            
            // Configure x-axis based on timeframe
            this.chart.options.scales.x = {
                type: 'category',
                title: {
                    display: true,
                    text: this.timeframe === 'weekly' ? 'Day of Week' : 'Hour of Day',
                    font: { weight: 'bold' }
                },
                ticks: {
                    autoSkip: false,
                    maxRotation: 45
                }
            };
    
            this.chart.options.plugins.title.text = 
                `Parking Occupancy - ${this.timeframe.charAt(0).toUpperCase() + this.timeframe.slice(1)} View`;
    
            this.chart.update();
            this.hideLoading();
    
        } catch (error) {
            console.error('Data loading error:', error);
            this.showError('Failed to load dashboard data');
        }
    }
}

// Initialize dashboard when the analysis page is shown
document.getElementById('analysisTab').addEventListener('click', () => {
    if (!window.parkingDashboard) {
        window.parkingDashboard = new ParkingDashboard();
    }
});