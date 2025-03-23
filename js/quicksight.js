export function embedQuickSightDashboard(type = 'daily') {
    try {
        const dashboardUrls = {
            daily: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/f54f792c-9a8f-4d9e-b679-227e1c2257c3?directory_alias=AmazonPark-PeakTimes",
            weekly: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/953a2fba-f0fd-4d2f-bac5-218d43e6e866?directory_alias=AmazonPark-PeakTimes"
        };

        // No need for API call since we're using direct URLs
        const options = {
            url: dashboardUrls[type],
            container: '#quicksight-dashboard',
            height: '700px',
            width: '100%',
            loadCallback: () => console.log(`QuickSight ${type} Dashboard loaded`),
            errorCallback: (err) => console.error('QuickSight Error:', err)
        };

        QuickSightEmbedding.embed(options);
    } catch (error) {
        console.error('QuickSight embedding error:', error);
    }
}

// Make it available globally
window.embedQuickSightDashboard = embedQuickSightDashboard;