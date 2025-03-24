export function embedQuickSightDashboard(type = 'daily') {
    try {
        const dashboardUrls = {
            daily: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/f54f792c-9a8f-4d9e-b679-227e1c2257c3?directory_alias=AmazonPark-PeakTimes",
            weekly: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/953a2fba-f0fd-4d2f-bac5-218d43e6e866?directory_alias=AmazonPark-PeakTimes"
        };

        const container = document.getElementById('quicksight-dashboard');
        container.innerHTML = `
            <iframe
                width="100%"
                height="500px"
                src="${dashboardUrls[type]}?&css=body{background:transparent}"
                frameborder="0"
                style="transform: scale(1.0); transform-origin: 0 0;"
                allowfullscreen>
            </iframe>
        `;
    } catch (error) {
        console.error('Error embedding dashboard:', error);
    }
}

// Make available globally
window.embedQuickSightDashboard = embedQuickSightDashboard;