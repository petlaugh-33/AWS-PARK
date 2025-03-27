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
        // Show loading state
        containerDiv.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading dashboard...</p>
            </div>
        `;

        console.log('Fetching dashboard URL...');
        const response = await fetch(`${API_ENDPOINT}?type=${dashboardType}`);
        const responseData = await response.json();
        const data = JSON.parse(responseData.body);

        if (!data.embedUrl) {
            throw new Error('No embed URL received');
        }

        // Clear loading state before embedding
        containerDiv.innerHTML = '';

        const options = {
            url: data.embedUrl,
            container: containerDiv,
            height: "800px",
            width: "100%",
            scrolling: "no",
            printEnabled: false,
            loadingHeight: "800px"
        };

        const dashboard = QuickSightEmbedding.embedDashboard(options);

        dashboard.on('error', function(error) {
            console.error('Error loading dashboard:', error);
            containerDiv.innerHTML = `
                <div class="alert alert-danger">
                    Error loading dashboard. Please try again.
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="location.reload()">Reload</button>
                </div>
            `;
        });

        dashboard.on('load', function() {
            console.log('Dashboard loaded successfully');
            // Remove any leftover loading indicators
            const loadingElements = containerDiv.getElementsByClassName('text-center p-4');
            if (loadingElements.length > 0) {
                loadingElements[0].remove();
            }
        });

    } catch (error) {
        console.error('Failed to load dashboard:', error);
        containerDiv.innerHTML = `
            <div class="alert alert-danger">
                Error loading dashboard: ${error.message}
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="location.reload()">Reload</button>
            </div>
        `;
    }
}

export { getCurrentDate };


