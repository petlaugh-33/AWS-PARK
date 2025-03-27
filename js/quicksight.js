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
        console.log('Fetching dashboard URL...');
        const response = await fetch(`${API_ENDPOINT}?type=${dashboardType}`);
        const responseData = await response.json();
        
        // Parse the nested JSON in the body
        const data = JSON.parse(responseData.body);
        console.log('Parsed dashboard data:', data);

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

        console.log('Embedding dashboard with options:', options);

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

export { getCurrentDate };

