function getCurrentDate() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var yyyy = today.getFullYear();

    today = yyyy + '-' + mm + '-' + dd;
    return today;
}

const API_ENDPOINT = 'https://g11syiymjl.execute-api.us-east-1.amazonaws.com/prod';


export async function embedQuickSightDashboard(containerDiv, dashboardType) {
    try {
        // Fetch embed URL from our API
        const response = await fetch(`${API_ENDPOINT}?type=${dashboardType}`);
        const data = await response.json();

        if (!data.embedUrl) {
            throw new Error('No embed URL received');
        }

        // Configure dashboard options
        const options = {
            url: data.embedUrl,
            container: containerDiv,
            height: "1000px",
            width: "100%",
            scrolling: "no",
            printEnabled: false,
            loadingHeight: "1000px"
        };

        // Embed the dashboard
        const dashboard = QuickSightEmbedding.embedDashboard(options);

        dashboard.on('error', function(error) {
            console.error('Error loading dashboard:', error);
            containerDiv.innerHTML = 'Error loading dashboard. Please try again.';
        });

        dashboard.on('load', function() {
            console.log('Dashboard loaded successfully');
        });

    } catch (error) {
        console.error('Failed to load dashboard:', error);
        containerDiv.innerHTML = 'Error loading dashboard. Please refresh the page.';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const containerDiv = document.getElementById('embedded-dashboard');
    const dailyBtn = document.getElementById('dailyDashboard');
    const weeklyBtn = document.getElementById('weeklyDashboard');
    const dateSpan = document.getElementById('currentDate');

    // Set current date
    if (dateSpan) {
        dateSpan.textContent = getCurrentDate();
    }

    // Event listeners for buttons
    if (dailyBtn) {
        dailyBtn.addEventListener('click', function() {
            embedDashboard(containerDiv, 'daily');
            dailyBtn.classList.add('active');
            weeklyBtn.classList.remove('active');
        });
    }

    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', function() {
            embedDashboard(containerDiv, 'weekly');
            weeklyBtn.classList.add('active');
            dailyBtn.classList.remove('active');
        });
    }

    // Load daily dashboard by default
    embedDashboard(containerDiv, 'daily');
    if (dailyBtn) {
        dailyBtn.classList.add('active');
    }
});
