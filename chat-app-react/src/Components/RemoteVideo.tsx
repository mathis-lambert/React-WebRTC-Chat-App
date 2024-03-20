import {userIF} from "../Interfaces/Interfaces.ts";
import {MoreHorizontal} from "react-feather";
import WebRTCManager from "../scripts/WebRTCManager.ts";
import {memo, useEffect, useRef, useState} from "react";
import {socketConn} from "../Socket/socket.ts";


interface RemoteVideoIF {
    webRTCManager: WebRTCManager | null;
    stream: MediaStream;
    user: userIF;
    status: string;
    callInitiator: string;
    isCallInitiator: boolean;
}

const RemoteVideo = ({webRTCManager, stream, user, status, callInitiator, isCallInitiator}: RemoteVideoIF) => {
    const [modalVisibility, setModalVisibility] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const makeCallInitiator = () => {
        console.log("Give call initiator to " + user.username);
        socketConn.emit("make_call_initiator", {discussion: webRTCManager?.discussion, target: user.id});
    }


    return (
        <div className="remote-video-container">
            <video autoPlay playsInline className={"remote-video"} ref={videoRef}></video>
            <div className="remote-video-info">
                <p className={"stream-name"}>{user.username} {callInitiator === user.id ? "(Animateur)" : ""}</p>
                <p className={"stream-status " + (status)}
                   title={status}></p>
            </div>

            <div className="remote-video-options">
                <button className="remote-video-button" onClick={() => {
                    setModalVisibility(!modalVisibility);
                }}><MoreHorizontal/></button>
            </div>

            <div className={"remote-video-options-modal" + (modalVisibility ? " show" : "")}>
                {isCallInitiator && (
                    <button className="remote-video-button" onClick={makeCallInitiator}>
                        Rendre animateur
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