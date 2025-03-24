export function embedQuickSightDashboard(type = 'daily') {
    try {
        const dashboardUrls = {
            daily: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/f54f792c-9a8f-4d9e-b679-227e1c2257c3/sheets/f54f792c-9a8f-4d9e-b679-227e1c2257c3_ffda5cb1-add2-40e6-a672-4005609c11f3/visuals/f54f792c-9a8f-4d9e-b679-227e1c2257c3_405a46fe-02f4-4183-a569-bd23af4ebb5a?directory_alias=AmazonPark-PeakTimes",
            weekly: "https://us-east-1.quicksight.aws.amazon.com/sn/embed/share/accounts/160885289976/dashboards/953a2fba-f0fd-4d2f-bac5-218d43e6e866?directory_alias=AmazonPark-PeakTimes"
        };
        const container = document.getElementById('quicksight-dashboard');
        container.innerHTML = `
            <iframe
                width="100%"
                height="1000px"
                src="${dashboardUrls[type]}"
                frameborder="0"
                allowfullscreen>
            </iframe>
        `;
    } catch (error) {
        console.error('Error embedding dashboard:', error);
    }
}

window.embedQuickSightDashboard = embedQuickSightDashboard;