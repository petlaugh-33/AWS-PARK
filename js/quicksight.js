export function embedQuickSightDashboard(type = 'daily') {
    console.log('Attempting to embed QuickSight dashboard:', type);
    
    if (!window.QuickSightJS) {
        console.error('QuickSight SDK not loaded');
        return;
    }

    try {
        const dashboardUrls = {
            daily: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/f54f792c-9a8f-4d9e-b679-227e1c2257c3?directory_alias=AmazonPark-PeakTimes",
            weekly: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/953a2fba-f0fd-4d2f-bac5-218d43e6e866?directory_alias=AmazonPark-PeakTimes"
        };

        const container = document.getElementById('quicksight-dashboard');
        if (!container) {
            console.error('Dashboard container not found');
            return;
        }

        const options = {
            url: dashboardUrls[type],
            container: '#quicksight-dashboard',
            height: '700px',
            width: '100%',
            loadCallback: () => console.log(`${type} dashboard loaded successfully`),
            errorCallback: (err) => console.error('Dashboard error:', err)
        };

        console.log('Embedding with options:', options);
        QuickSightJS.embed(options);

    } catch (error) {
        console.error('Error embedding dashboard:', error);
    }
}

// Make available globally
window.embedQuickSightDashboard = embedQuickSightDashboard;