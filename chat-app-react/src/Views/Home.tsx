// import '../style/App.scss'
import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {socketConn} from "../Socket/socket.ts";
import UserList from "../Components/UserList.tsx";
import MessagesList from "../Components/MessagesList.tsx";
import DiscussionsList from "../Components/DiscussionsList.tsx";
import SendMessage from "../Components/SendMessage.tsx";
import {
    DiscussionIF,
    DiscussionsIF,
    ReceiveOfferIF,
    SocketID,
    streamIF,
    streamListIF,
    userIF
} from "../Interfaces/Interfaces.ts";
import WebRTCManager from "../scripts/WebRTCManager.ts";
import IncomingCallModal from "../Components/IncomingCallModal.tsx";
import ScreenSharingOverlay from "../Components/ScreenSharingOverlay.tsx";
import NewDiscussion from "../Components/NewDiscussion.tsx";
import RemoteVideo from "../Components/RemoteVideo.tsx";

const Home = ({self, connectedUsers, setLoggedIn, loggedIn}: {
    self: userIF,
    connectedUsers: userIF[],
    setLoggedIn: (loggedIn: boolean) => void,
    loggedIn: boolean
}) => {
    const [peersStreams, setPeersStreams] = useState<streamListIF>({});
    const [usersInCall, setUsersInCall] = useState<userIF[]>([]);
    const [inDiscussion, setInDiscussion] = useState<boolean>(false);
    const [discussionInfo, setDiscussionInfo] = useState<DiscussionIF | null>(null);
    const [createDiscussion, setCreateDiscussion] = useState<boolean>(false);
    const [showCallButtons, setShowCallButtons] = useState(false);

    const [speakingTo, setSpeakingTo] = useState<string>("Choisissez une discussion pour commencer");
    const [inCall, setInCall] = useState(false);
    const [calling, setCalling] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const [webRTCManager, setWebRTCManager] = useState<WebRTCManager | null>(null);

    const [modalIncomingCall, setModalIncomingCall] = useState(false);
    const [modalIncomingCallData, setModalIncomingCallData] = useState<ReceiveOfferIF | null>(null);

    const [isCallInitiator, setIsCallInitiator] = useState<boolean>(false);
    const [callInitiator, setCallInitiator] = useState<string>('');

    // location object
    const location = useLocation();
    const Navigate = useNavigate();

    useEffect(() => {
        const webRTCManager = new WebRTCManager(socketConn, self, connectedUsers, {
            updateRemoteStreams: updateRemoteStreams,
            setRemoteStreams: setPeersStreams,
            acceptIncomingCall: (offer: ReceiveOfferIF) => {
                setModalIncomingCallData(offer);
                setModalIncomingCall(true);
            },
            setInCall: setInCall,
            setIsSharingScreen: setIsScreenSharing,
            setCalling: setCalling,
            setCallInitiator: setCallInitiator,
            setIsCallInitiator: setIsCallInitiator
        })

        setWebRTCManager(webRTCManager);
    }, []);

    useEffect(() => {
        if (webRTCManager) {
            webRTCManager.setConnectedUsers(connectedUsers)
        }
    }, [webRTCManager, connectedUsers]);

    useEffect(() => {
        socketConn.on('discussion_created', (data: DiscussionsIF) => {
            // console.log("Discussion created: " + JSON.stringify(data));
            Navigate(`/discussion/${Object.keys(data)[0]}`);
            setInDiscussion(true);
        });

        socketConn.on("discussion_info", (data: DiscussionIF) => {
            // console.log("Discussion info: " + JSON.stringify(data));
            if (data) {
                setShowCallButtons(true);
                setDiscussionInfo(data);
            }
        });

        // Fonction de nettoyage si nécessaire, par exemple :
        return () => {
            socketConn.off("discussion_created");
            socketConn.off("discussion_info");
        }
    }, [Navigate]);

    useEffect(() => {
        if (loggedIn) {
            if (location.pathname.split("/")[1] === "discussion") {
                const discussionId = location.pathname.split("/")[2];
                console.log("Discussion ID: " + discussionId);
                socketConn.emit('get_discussion_info', discussionId);
                setInDiscussion(true);
            } else {
                setSpeakingTo("Choisissez une discussion pour commencer");
                setShowCallButtons(false);
            }
        } else {
            setInDiscussion(false);
            window.history.pushState({}, "", `/`);
        }
    }, [location, loggedIn]);

    useEffect(() => {
        if (Object.keys(peersStreams).length > 0) {
            setUsersInCall(Object.values(peersStreams).map((stream) => stream.user));
        }
    }, [peersStreams]);

    const updateRemoteStreams = (socketId: SocketID, stream: streamIF) => {
        setPeersStreams((prevStreams) => {
            return {...prevStreams, [socketId]: stream};
        });
    }

    async function call(type: 'video' | 'audio') {
        const discussionId = location.pathname.split("/")[2];
        if (discussionId === undefined) return;
        console.log("Calling discussion : " + discussionId);

        setCalling(true);
        const members: string[] = discussionInfo?.members || [];
        const ids = []
        if (members) {
            for (const member of members) {
                const socketId = connectedUsers.find((user) => user.uuid === member && user.connected)?.id;
                if (socketId) ids.push(socketId);
            }
        }

        console.log("Calling members: " + JSON.stringify(ids));
        webRTCManager ? await webRTCManager.createOffer(ids, discussionId, type, self.id) : null;
    }

    async function handleIncomingCall(accepted: boolean) {
        console.log("Incoming call");
        if (modalIncomingCallData) {
            if (accepted) {
                console.log("Call accepted");
                Navigate(`/discussion/${modalIncomingCallData.discussion}`)
                webRTCManager ? await webRTCManager.acceptIncomingCall(accepted, modalIncomingCallData) : null;
            } else {
                console.log("Call rejected");
                socketConn.emit('reject_call', {target: modalIncomingCallData.sender});
            }
            setModalIncomingCall(false);
            setModalIncomingCallData(null);
        }
    }

    async function StopCall() {
        if (inCall) {
            console.log("Stopping call");
            webRTCManager ? await webRTCManager.endCall() : null;
            setInCall(false);
            setCalling(false);
            setIsScreenSharing(false);
            setModalIncomingCall(false);
            setModalIncomingCallData(null);
            setPeersStreams({});
        }
    }

    async function StartScreenSharing() {

        if (inCall && webRTCManager ? webRTCManager.isCallInitiator : false) {
            console.log("Start Screen Sharing " + self.username);
            webRTCManager ? await webRTCManager.shareScreen() : null;
            setIsScreenSharing(true);
        }
    }

    function stopScreenSharing() {
        if (inCall && isScreenSharing) {
            console.log("Stopping Screen Sharing " + self.username);
            if (webRTCManager) {
                webRTCManager ? webRTCManager.stopSharingScreen() : null;
            }
        }
    }

    async function createOfferForNewUser(target: string) {
        if (webRTCManager && inCall && isCallInitiator) {
            await webRTCManager.createOffer([target], webRTCManager.discussion, 'video', self.id);
        }
    }

    // handle the disconnect event
    async function handleDisconnect() {
        if (inCall) await StopCall();

        // redirect to the login page /
        Navigate("/");

        console.log("Disconnected from the server");
        socketConn.disconnect();
        setLoggedIn(false);
    }

    return (

        <>
            <IncomingCallModal modalIncomingCall={modalIncomingCall} caller={modalIncomingCallData?.pseudo_caller}
                               acceptCall={handleIncomingCall}/>
            <ScreenSharingOverlay isScreenSharing={isScreenSharing}/>

            <div id="chat-container">
                {!inCall && !calling && (
                    <div className="left" id={'discussion'}>
                        {!createDiscussion && inDiscussion && (
                            <>
                                <div>
                                    <p id="speaking-to">{speakingTo}</p>
                                    <div className="call-buttons" id="call-buttons">
                                        {!inCall && showCallButtons && (
                                            <>
                                                <button id="video-call" onClick={() => call('video')}>Appel
                                                    vidéo
                                                </button>
                                                <button id="audio-call" onClick={() => call('audio')}>Appel
                                                    audio
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>


                                <MessagesList self={self}/>
                                <SendMessage self={self}/>
                            </>
                        )}

                        {!inDiscussion && !createDiscussion && (
                            <p>Choisissez une discussion pour commencer</p>
                        )}
                        <NewDiscussion createDiscussion={createDiscussion} setCreateDiscussion={setCreateDiscussion}
                                       connectedUsers={connectedUsers} self={self} setSpeakingTo={setSpeakingTo}/>

                    </div>
                )}
                {(inCall || calling) && (
                    <div className={"left"} id={'call'}>
                        <div>
                            <div className="call-buttons" id="call-buttons">
                                {isCallInitiator && (
                                    <>
                                        <button id="share-screen" onClick={StartScreenSharing}>Partager
                                            l'écran
                                        </button>
                                        {isScreenSharing && (
                                            <button id="stop-sharing"
                                                    onClick={stopScreenSharing}>Arrêter le
                                                partage
                                            </button>
                                        )}
                                    </>
                                )}
                                <button id="hang-up" onClick={StopCall}>
                                    {isCallInitiator ? "Terminer l'appel" : "Quitter l'appel"}
                                </button>
                            </div>

                            <em>
                                {isCallInitiator ? "Vous êtes l'animateur" : ''}
                            </em>
                        </div>

                        <div id="video-container">
                            <video autoPlay playsInline id="local-video" muted ref={video => {
                                if (video && webRTCManager) {
                                    video.srcObject = webRTCManager.localStream;
                                }
                            }}></video>

                            <video autoPlay playsInline id="local-screen-sharing" muted
                                   className={isScreenSharing ? "show" : "hidden"}
                                   ref={video => {
                                       if (video && webRTCManager) {
                                           video.srcObject = webRTCManager.localScreen;
                                       }
                                   }}></video>

                            {calling && (<p>Appel en cours...</p>)}

                            {Object.keys(peersStreams).length > 0 && (
                                <div id="remote-videos">
                                    {Object.values(peersStreams).map((stream) => (
                                        <RemoteVideo key={stream.user.id} webRTCManager={webRTCManager}
                                                     stream={stream.stream} user={stream.user} status={stream.status}
                                                    callInitiator={callInitiator} isCallInitiator={isCallInitiator}
                                        />
                                    ))}
                                </div>
                            )}

                        </div>
                    </div>
                )}
                <div className="right">
                    <DiscussionsList createDiscussion={() => setCreateDiscussion(true)} self={self}
                                     connectedUsers={connectedUsers} setSpeakingTo={setSpeakingTo}/>
                    <UserList self={self} connectedUsers={connectedUsers} usersInCall={usersInCall} inCall={inCall} isCallInitiator={isCallInitiator} createOffer={createOfferForNewUser}/>
                    <div className="logout">
                        {/*<select className="hidden" id="video-source"></select>*/}
                        {/*<select className="hidden" id="audio-source"></select>*/}
                        {/*<select className="hidden" id="resolutions"></select>*/}
                        <button id="logout" onClick={handleDisconnect}>Déconnexion</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Home;