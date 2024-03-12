interface screenSharingOverlayIF {
    isScreenSharing: boolean;
}

const screenSharingOverlay = ({isScreenSharing}: screenSharingOverlayIF) => {
    return (
        <>
                <div className={"screen-recording-overlay" + (isScreenSharing ? " show" : " hidden")}>
                    <p>Partage d'écran en cours</p>
                </div>
        </>
    )
}

export default screenSharingOverlay