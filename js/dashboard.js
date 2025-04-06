// js/dashboard.js
class ParkingDashboard {
    constructor() {
        this.chart = null;
        this.timeframe = 'daily';
        this.containerDiv = document.getElementById('dashboard-container');
        this.loadingDiv = document.getElementById('dashboard-loading');
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
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
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
                        text: 'Parking Occupancy - Daily View'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Occupancy Rate (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    }
                }
            }
        });
    }

    generateMockData() {
        if (this.timeframe === 'daily') {
            // Generate realistic daily pattern
            return Array.from({length: 24}, (_, hour) => {
                if (hour >= 7 && hour <= 9) { // Morning peak
                    return 70 + Math.random() * 20;
                } else if (hour >= 16 && hour <= 18) { // Evening peak
                    return 75 + Math.random() * 20;
                } else if (hour >= 23 || hour <= 5) { // Night time
                    return 10 + Math.random() * 15;
                } else { // Regular hours
                    return 30 + Math.random() * 30;
                }
            });
        } else { // weekly
            // Generate week pattern with lower weekend occupancy
            return Array.from({length: 24}, () => 40 + Math.random() * 40);
        }
    }

    async loadDashboardData() {
        try {
            this.showLoading();
            this.updateDateTime();

            // Simulate loading delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            const data = this.generateMockData();

            this.chart.options.plugins.title.text = 
                `Parking Occupancy - ${this.timeframe.charAt(0).toUpperCase() + this.timeframe.slice(1)} View`;
            
            this.updateChartData(data);
            this.hideLoading();
        } catch (error) {
            this.showError('Failed to load dashboard data');
            console.error('Data loading error:', error);
        }
    }

    updateChartData(data) {
        if (this.chart) {
            this.chart.data.datasets[0].data = data;
            this.chart.update();
        }
    }

    updatePeakStats(data) {
        const peakHours = data.slice(7,9).concat(data.slice(16,18));
        const offPeakHours = data.filter((_, i) => !([7,8,16,17].includes(i)));
        
        const peakAvg = peakHours.reduce((a,b) => a + b, 0) / peakHours.length;
        const offPeakAvg = offPeakHours.reduce((a,b) => a + b, 0) / offPeakHours.length;
        
        document.getElementById('peakStats').textContent = 
            `Peak: ${peakAvg.toFixed(2)}%, Off-Peak: ${offPeakAvg.toFixed(2)}%`;
    }
}

// Initialize dashboard when the analysis page is shown
document.getElementById('analysisTab').addEventListener('click', () => {
    if (!window.parkingDashboard) {
        window.parkingDashboard = new ParkingDashboard();
    }
});