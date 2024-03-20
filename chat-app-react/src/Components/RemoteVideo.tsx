import {userIF} from "../Interfaces/Interfaces.ts";
import {MoreHorizontal} from "react-feather";
import WebRTCManager from "../scripts/WebRTCManager.ts";
import {memo, useEffect, useRef, useState} from "react";

interface RemoteVideoIF {
    webRTCManager: WebRTCManager | null;
    stream: MediaStream;
    user: userIF;
    status: string;
}

const RemoteVideo = ({webRTCManager, stream, user, status}: RemoteVideoIF) => {
    const [modalVisibility, setModalVisibility] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);


    return (
        <div className="remote-video-container">
            <video autoPlay playsInline className={"remote-video"} ref={videoRef}></video>
            <div className="remote-video-info">
                <p className={"stream-name"}>{user.username} {webRTCManager ? webRTCManager.callInitiator === user.id ? "(Animateur)" : "" : ""}</p>
                <p className={"stream-status " + (status)}
                   title={status}></p>
            </div>

            <div className="remote-video-options">
                <button className="remote-video-button" onClick={() => {
                    setModalVisibility(!modalVisibility);
                }}><MoreHorizontal/></button>
            </div>

            <div className={"remote-video-options-modal" + (modalVisibility ? " show" : "")}>
                {(webRTCManager ? webRTCManager.isCallInitiator : false) && (
                    <button className="remote-video-button" onClick={() => {
                    }}>Rendre animateur
                    </button>
                )}
                <button className="remote-video-button" disabled onClick={() => {
                }}>Mettre en sourdine
                </button>
                <button className="remote-video-button" disabled onClick={() => {
                }}>Arrêter la vidéo
                </button>
                <button className="remote-video-button" disabled onClick={() => {
                }}>Expulser
                </button>
            </div>
        </div>
    );
}

export default memo(RemoteVideo);