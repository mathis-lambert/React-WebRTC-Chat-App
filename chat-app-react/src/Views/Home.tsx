// import '../style/App.scss'
import {useEffect, useRef, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {socketConn} from "../Socket/socket.ts";
import UserList from "../Components/UserList.tsx";
import MessagesList from "../Components/MessagesList.tsx";
import DiscussionsList from "../Components/DiscussionsList.tsx";
import SendMessage from "../Components/SendMessage.tsx";
import {DiscussionIF, DiscussionsIF, ReceiveOfferIF, userID, userIF} from "../Interfaces/Interfaces.ts";
import WebRTCManager from "../scripts/WebRTCManager.ts";

const Home = ({self, connectedUsers, setLoggedIn, loggedIn}: {
    self: userIF,
    connectedUsers: userIF[],
    setLoggedIn: (loggedIn: boolean) => void,
    loggedIn: boolean
}) => {
    const [peersStreams, setPeersStreams] = useState<MediaStream[]>([]);
    const [inDiscussion, setInDiscussion] = useState<boolean>(false);
    const [discussionInfo, setDiscussionInfo] = useState<DiscussionIF | null>(null);
    const [createDiscussion, setCreateDiscussion] = useState<boolean>(false);
    const [createDiscussionName, setCreateDiscussionName] = useState<string>("");
    const [createDiscussionUsers, setCreateDiscussionUsers] = useState<userIF[]>([]);
    const [showCallButtons, setShowCallButtons] = useState(false);
    // const [showHangUp, setShowHangUp] = useState(false);
    const [speakingTo, setSpeakingTo] = useState<string>("Choisissez une discussion pour commencer");
    const [inCall, setInCall] = useState(false);
    const [calling, setCalling] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localScreenSharingRef = useRef<HTMLVideoElement | null>(null);

    const [webRTCManager, setWebRTCManager] = useState<WebRTCManager | null>(null);

    const [modalIncomingCall, setModalIncomingCall] = useState(false);
    const [modalIncomingCallData, setModalIncomingCallData] = useState<ReceiveOfferIF | null>(null);

    // location object
    const location = useLocation();
    const Navigate = useNavigate();

    useEffect(() => {
        const webRTCManager = new WebRTCManager(socketConn, self, connectedUsers, {
            setRemoteStreams: setRemoteStreams,
            setLocalStream: (stream: MediaStream) => setStream('local', stream),
            setLocalScreen: (stream: MediaStream) => setStream('screen', stream),
            acceptIncomingCall: (offer: ReceiveOfferIF) => {
                setModalIncomingCallData(offer);
                setModalIncomingCall(true);
            },
            setInCall: setInCall
        })

        setWebRTCManager(webRTCManager);
    }, []);

    useEffect(() => {
        socketConn.on('discussion_created', (data: DiscussionsIF) => {
            // console.log("Discussion created: " + JSON.stringify(data));
            Navigate(`/discussion/${Object.keys(data)[0]}`);
            setInDiscussion(true);
            setSpeakingTo(data[Object.keys(data)[0]].name);
        });

        socketConn.on("discussion_info", (data: DiscussionIF) => {
            console.log("Discussion info: " + JSON.stringify(data));
            if (data) {
                setSpeakingTo(data.name);
                setShowCallButtons(true);
                setDiscussionInfo(data);
            }
        });

        // Fonction de nettoyage si nécessaire, par exemple :
        return () => {
            socketConn.off("discussion_created");
            socketConn.off("discussion_info");
        }
    }, []);

    async function call(type: 'video' | 'audio') {
        const discussionId = location.pathname.split("/")[2];
        if (discussionId === undefined) return;

        console.log("Calling discussion : " + discussionId);
        const members: string[] = discussionInfo?.members || [];
        const ids = []
        if (members) {
            for (const member of members) {
                const socketId = connectedUsers.find((user) => user.uuid === member && user.connected)?.id;
                if (socketId) ids.push(socketId);
            }
        }

        console.log("Calling members: " + JSON.stringify(ids));
        setCalling(true);
        webRTCManager ? await webRTCManager.createOffer(ids, discussionId, type, self.id) : null;
    }

    async function handleIncomingCall(accepted: boolean) {
        console.log("Incoming call");
        if (modalIncomingCallData) {
            if (accepted) {
                console.log("Call accepted");
                setCalling(true);
                webRTCManager ? await webRTCManager.acceptIncomingCall(accepted, modalIncomingCallData) : null;
                // TODO: WebRTCManager.acceptCall(data.sender, data.offer, data.type);
            } else {
                console.log("Call rejected");
                socketConn.emit('reject_call', {target: modalIncomingCallData.sender});
            }
            setModalIncomingCall(false);
            setModalIncomingCallData(null);
        }
    }

    async function StopCall() {
        const discussionId = location.pathname.split("/")[2];
        if (discussionId === undefined) return;


        console.log("Stopping call with " + discussionId);

        socketConn.emit('hang_up', {target: discussionId});
        setInCall(false);
        setCalling(false);
        setIsScreenSharing(false);
        setModalIncomingCall(false);
        setModalIncomingCallData(null);
        setPeersStreams([]);
        setStream('local', new MediaStream());
        setStream('screen', new MediaStream());
        webRTCManager ? await webRTCManager.endCall() : null;
    }

    // async function StartScreenSharing() {
    //     const discussionId = location.search.split("=")[1];
    //     const user = connectedUsers.find((u) => u.uuid === discussionId);
    //     if (user) {
    //         console.log("Start Screen Sharing " + user.username);
    //         webRTCPeer ? webRTCPeer.shareScreen() : null;
    //     }
    // }
    //
    // function stopScreenSharing() {
    //     const discussionId = location.search.split("=")[1];
    //     const user = connectedUsers.find((u) => u.uuid === discussionId);
    //     if (user) {
    //         console.log("Stopping Screen Sharing " + user.username);
    //         if (localScreenSharingRef.current?.srcObject) {
    //             let screenTrack: MediaStreamTrack | null = null;
    //             if ('getVideoTracks' in localScreenSharingRef.current.srcObject) {
    //                 screenTrack = localScreenSharingRef.current.srcObject.getVideoTracks()[0];
    //             }
    //             if (screenTrack) {
    //                 console.log("Stopping screen track")
    //                 screenTrack.stop();
    //             }
    //             webRTCPeer ? webRTCPeer.stopSharing() : null;
    //         }
    //     }
    // }


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
    }, [location]);

    const setStream = (source: 'local' | 'screen', stream: MediaStream) => {
        console.log("Setting stream " + source + " " + stream.id)
        if (source === 'local') {
            if (localVideoRef.current) {
                console.log("Setting local video")
                setLocalStream(stream);
                localVideoRef.current.srcObject = stream;
            } else {
                console.error("Local video ref is null")
            }
        }

        if (source === 'screen') {
            if (localScreenSharingRef.current) {
                localScreenSharingRef.current.srcObject = stream;
            } else {
                console.error("Local screen sharing ref is null")
            }
        }
    }

    const setRemoteStreams = (streams: MediaStream[]) => {
        setPeersStreams(streams);
    }


    // handle the disconnect event
    function handleDisconnect() {
        console.log("Disconnected from the server");
        socketConn.disconnect();
        setLoggedIn(false);
    }

    function handleCreateDiscussion() {
        interface newDiscussionIF {
            name: string,
            members: userID[]
        }

        const newDiscussion: newDiscussionIF = {
            name: createDiscussionName,
            members: createDiscussionUsers.map((user) => user.uuid)
        }

        console.log("New discussion: " + JSON.stringify(newDiscussion));

        socketConn.emit("nouvelle_discussion", newDiscussion);
        setCreateDiscussion(false);
        setCreateDiscussionName("");
        setCreateDiscussionUsers([]);
    }

    function handleCheckedUser(user: userIF) {
        console.log("Checked user: " + user.username);
        if (createDiscussionUsers.find((u) => u.id === user.id)) {
            setCreateDiscussionUsers(createDiscussionUsers.filter((u) => u.id !== user.id));
        } else {
            setCreateDiscussionUsers([...createDiscussionUsers, user]);
        }
    }

    return (

        <>
            {modalIncomingCall && (
                <div id="is-calling">
                    <p>{modalIncomingCallData?.pseudo_caller} vous appelle</p>
                    <button id="acceptButton" onClick={() => handleIncomingCall(true)}>Accepter</button>
                    <button id="rejectButton" onClick={() => handleIncomingCall(false)}>Rejeter</button>
                </div>
            )}
            {isScreenSharing && (
                <div className="screen-recording-overlay"></div>
            )}
            <div id="chat-container">
                <div className="left">
                    {!createDiscussion && (
                        <>
                            <div>
                                <p id="speaking-to">{speakingTo}</p>
                                <p id="call-status"></p>
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
                                    {inCall && (
                                        <>
                                            {/*<button id="share-screen" onClick={StartScreenSharing}>Partager*/}
                                            {/*    l'écran*/}
                                            {/*</button>*/}
                                            {/*{isScreenSharing && (*/}
                                            {/*    <button id="stop-sharing"*/}
                                            {/*            onClick={stopScreenSharing}>Arrêter le*/}
                                            {/*        partage*/}
                                            {/*    </button>*/}
                                            {/*)}*/}
                                            <button id="hang-up" onClick={StopCall}>Raccrocher
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div id="video-container" className={!calling ? "hidden" : ""}>
                                <video autoPlay id="local-video" muted ref={localVideoRef}></video>

                                <video autoPlay id="local-screen-sharing" muted
                                       className={isScreenSharing ? "show" : "hidden"}
                                       ref={localScreenSharingRef}></video>

                                {!inCall && calling && (<p>Appel en cours...</p>)}

                                {/*<video autoPlay id="remote-video" ref={remoteVideoRef}></video>*/}
                                <div id="remote-videos">
                                    {peersStreams?.map((stream, index) => (
                                        <video key={index} autoPlay playsInline className={"remote-video"}
                                               ref={video => {
                                                   if (video) video.srcObject = stream;
                                               }}/>
                                    ))}
                                </div>

                            </div>


                            <MessagesList connectedUsers={connectedUsers} self={self}/>
                            <SendMessage self={self}/>
                        </>
                    )}

                    {createDiscussion && (
                        <div>
                            <h3>Nouvelle discussion</h3>
                            <input id="new-discussion-input" type="text" placeholder="Nom de la discussion"
                                   value={createDiscussionName}
                                   onChange={(e) => setCreateDiscussionName(e.target.value)}/>
                            <div id="new-discussion-users">
                                <h4>Utilisateurs</h4>
                                <ul id="new-discussion-users-list">
                                    {connectedUsers.map((user) => {
                                        if (user.id === self.id) return;
                                        return <li key={user.uuid}>
                                            <input type="checkbox" value={user.uuid} id={`user-${user.uuid}`}
                                                   onChange={() => handleCheckedUser(user)}/>&nbsp;
                                            <label htmlFor={`user-${user.uuid}`}> {user.username}</label></li>
                                    })}
                                </ul>
                            </div>

                            <button id="new-discussion-submit" onClick={handleCreateDiscussion}>Créer
                            </button>
                            <button id="cancel-new-discussion"
                                    onClick={() => setCreateDiscussion(false)}>Annuler
                            </button>
                        </div>
                    )}

                </div>
                <div className="right">
                    <DiscussionsList createDiscussion={() => setCreateDiscussion(true)} self={self}
                                     connectedUsers={connectedUsers}/>
                    <UserList self={self} connectedUsers={connectedUsers}/>
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