// import '../style/App.scss'
import '../style/Home.scss'
import WebRTCPeerConnection from "../scripts/WebRTCPeerConnection.ts";
import {Socket} from "socket.io-client";
import React, {useEffect, useRef, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {socketConn} from "../Socket/socket.ts";
import UserList from "../Components/UserList.tsx";
import MessagesList from "../Components/MessagesList.tsx";
import DiscussionsList from "../Components/DiscussionsList.tsx";
import SendMessage from "../Components/SendMessage.tsx";
import {DiscussionsIF, ReceiveOfferIF, userID, userIF} from "../Interfaces/Interfaces.ts";

// interface PeersIF {
//     [key: string]: RTCPeerConnection;
// }
//
// interface PendingCandidatesIF {
//     [key: string]: RTCIceCandidate;
// }

const Home = () => {
    const [connectedUsers, setConnectedUsers] = useState<userIF[]>([]);
    const [peersStreams, setPeersStreams] = useState<MediaStream[]>([]);
    const [inDiscussion, setInDiscussion] = useState<boolean>(false);
    const [createDiscussion, setCreateDiscussion] = useState<boolean>(false);
    const [createDiscussionName, setCreateDiscussionName] = useState<string>("");
    const [createDiscussionUsers, setCreateDiscussionUsers] = useState<userIF[]>([]);
    const [self, setSelf] = useState<userIF>({username: "", id: "", uuid: "", connected: false});
    const [loggedIn, setLoggedIn] = useState<boolean>(false);
    const [showCallButtons, setShowCallButtons] = useState(false);
    // const [showHangUp, setShowHangUp] = useState(false);
    const [speakingTo, setSpeakingTo] = useState<string>("Choisissez une discussion pour commencer");
    const [inCall, setInCall] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localScreenSharingRef = useRef<HTMLVideoElement | null>(null);

    const [socket] = useState<Socket>(socketConn);
    const [webRTCPeer, setWebRTCPeer] = useState<WebRTCPeerConnection | null>(null);

    const [modalIncomingCall, setModalIncomingCall] = useState(false);
    const [modalIncomingCallData, setModalIncomingCallData] = useState<ReceiveOfferIF | null>(null);

    // location object
    const location = useLocation();
    const Navigate = useNavigate();

    useEffect(() => {
        const peer = new WebRTCPeerConnection(socket, connectedUsers, {
            setLocalStream: setStream,
            setRemoteStream: setStream,
            setRemoteStreams: setRemoteStreams,
            setScreenSharingStream: setStream,
            setIsScreenSharing: setIsScreenSharing,
            stopScreenSharing: stopScreenSharing,
            setInCall: setInCall,
            setCallStatus: setSpeakingTo,
            setCallButtons: setShowCallButtons,
            showCallAcceptanceDialog: (data: ReceiveOfferIF) => {
                setModalIncomingCallData(data);
                setModalIncomingCall(true);
            },
            resetCallStatus: () => {
                setSpeakingTo("Choisis une discussion pour commencer");
                setShowCallButtons(true);
                setInCall(false);
                setModalIncomingCall(false);
                setModalIncomingCallData(null);
                localVideoRef.current ? localVideoRef.current.srcObject = null : null;
                remoteVideoRef.current ? remoteVideoRef.current.srcObject = null : null;
                localScreenSharingRef.current ? localScreenSharingRef.current.srcObject = null : null;
            }
        });

        setWebRTCPeer(peer);

        // Fonction de nettoyage si nécessaire, par exemple :
        // return () => peer.close();
    }, []); // Dépendances pour déterminer quand recréer


    useEffect(() => {
        if (location.pathname.split("/")[1] === "discussion") {
            const discussionId = location.pathname.split("/")[2];
            console.log("Discussion ID: " + discussionId);
            if (discussionId) {
                setSpeakingTo(discussionId);
                setShowCallButtons(true);
            }
        } else {
            setSpeakingTo("Choisissez une discussion pour commencer");
            setShowCallButtons(false);
        }
    }, [location]);

    useEffect(() => {
        console.log(inCall)
    }, [inCall]);


    function setStream(source: 'local' | 'remote' | 'screen', stream: MediaStream) {
        console.log("Setting stream " + source + " " + stream.id)
        if (source === 'local') {
            if (localVideoRef.current) {
                console.log("Setting local video")
                localVideoRef.current.srcObject = stream;
            } else {
                console.error("Local video ref is null")
            }
        }

        if (source === 'remote') {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            } else {
                console.error("Remote video ref is null")
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

    function setRemoteStreams(streams: MediaStream[]) {
        console.log("Setting remote streams " + streams.length)
        setPeersStreams(streams);
    }


    function handleNameFormSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const nameInput = document.getElementById("name-input") as HTMLInputElement | null;
        if (nameInput) {
            const name = nameInput.value;
            nameInput.value = "";

            // TODO: hide the before-chat

            // TODO: show the chat container

            // send the name to the server
            socket.emit("connexion_utilisateur", name);

            // handle the identity event from the server
            socket.on("utilisateur_connecte", (data) => {
                // parse the data
                data = JSON.parse(data);
                window.history.pushState({}, "", `/`);
                setLoggedIn(true);
                // store the data in the connectedUsers variable
                setSelf(data);
            });
        }
    }

    useEffect(() => {
        socket.on('discussions_list', (data) => {
            data = JSON.parse(data);
            console.log("Data: " + JSON.stringify(data));
        })

        socket.on("liste_utilisateurs_connectes", (data) => {
            // parse the data
            data = JSON.parse(data);
            // console.log("Connected users: " + JSON.stringify(data));
            setConnectedUsers(data);
        });

        socket.on('discussion_created', (data: DiscussionsIF) => {
            console.log("Discussion created: " + JSON.stringify(data));
            Navigate(`/discussion/${Object.keys(data)[0]}`);
            setInDiscussion(true);
            setSpeakingTo(data[Object.keys(data)[0]].name);
        });

        // Fonction de nettoyage si nécessaire, par exemple :
        return () => {
            socket.off("discussions_list");
            socket.off("liste_utilisateurs_connectes");
            socket.off("discussion_created");
        }
    }, []);

// handle the disconnect event
    function handleDisconnect() {
        console.log("Disconnected from the server");
        socket.disconnect();
        window.location.reload();
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

        socket.emit("nouvelle_discussion", newDiscussion);
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

    async function StartCall(type: 'video' | 'audio' = 'video') {
        const discussionId = location.pathname.split("/")[2];

        if (discussionId === undefined) return;

        console.log("Calling discussion : " + discussionId);
        webRTCPeer ? await webRTCPeer.call(discussionId, type) : null;
    }

    async function StopCall() {
        const discussionId = location.pathname.split("/")[2];
        if (discussionId === undefined) return;


        console.log("Stopping call with " + discussionId);

        socket.emit('hang_up', {target: discussionId});
        webRTCPeer ? webRTCPeer.closeConnection() : null;

    }

    async function StartScreenSharing() {
        const discussionId = location.search.split("=")[1];
        const user = connectedUsers.find((u) => u.uuid === discussionId);
        if (user) {
            console.log("Start Screen Sharing " + user.username);
            webRTCPeer ? webRTCPeer.shareScreen() : null;
        }
    }

    function stopScreenSharing() {
        const discussionId = location.search.split("=")[1];
        const user = connectedUsers.find((u) => u.uuid === discussionId);
        if (user) {
            console.log("Stopping Screen Sharing " + user.username);
            if (localScreenSharingRef.current?.srcObject) {
                let screenTrack: MediaStreamTrack | null = null;
                if ('getVideoTracks' in localScreenSharingRef.current.srcObject) {
                    screenTrack = localScreenSharingRef.current.srcObject.getVideoTracks()[0];
                }
                if (screenTrack) {
                    console.log("Stopping screen track")
                    screenTrack.stop();
                }
                webRTCPeer ? webRTCPeer.stopSharing() : null;
            }
        }
    }

    function handleIncomingCall(accepted: boolean) {
        console.log("Incoming call");
        if (modalIncomingCallData) {
            webRTCPeer?.handleAcceptCall(modalIncomingCallData, accepted)
            setModalIncomingCall(false);
            setModalIncomingCallData(null);
        }
    }

    return (
        <>
            {!loggedIn && (
                <div className="before-chat">
                    <div className="form-container">
                        <h2>Entrez votre nom</h2>
                        <form id="name-form" onSubmit={handleNameFormSubmit}>
                            <input id="name-input" placeholder="Votre prénom..." type="text"/>
                            <button type="submit">Rejoindre</button>
                        </form>
                    </div>
                </div>
            )}

            {loggedIn && (
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
                                                    <button id="video-call" onClick={() => StartCall('video')}>Appel
                                                        vidéo
                                                    </button>
                                                    <button id="audio-call" onClick={() => StartCall('audio')}>Appel
                                                        audio
                                                    </button>
                                                </>
                                            )}
                                            {inCall && (
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
                                                    <button id="hang-up" onClick={StopCall}>Raccrocher
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div id="video-container" className={!inCall ? "hidden" : ""}>
                                        <video autoPlay id="local-video" muted ref={localVideoRef}></video>

                                        <video autoPlay id="local-screen-sharing" muted
                                               className={isScreenSharing ? "show" : "hidden"}
                                               ref={localScreenSharingRef}></video>

                                        {peersStreams.length === 0 && <p>Aucun utilisateur connecté</p>}

                                        <video autoPlay id="remote-video" ref={remoteVideoRef}></video>
                                        {inCall && peersStreams.length > 0 && (
                                            <div id="remote-videos">
                                                {peersStreams.map((stream, index) => {
                                                    return <video autoPlay key={index} id={`remote-video-${index}`}
                                                                  ref={(video) => {
                                                                      if (video) {
                                                                          video.srcObject = stream;
                                                                      }
                                                                  }}></video>
                                                })}
                                            </div>
                                        )}
                                    </div>


                                    <MessagesList connectedUsers={connectedUsers} self={self}/>
                                    <SendMessage self={self}/>
                                </>
                            )}

                            {!inDiscussion && createDiscussion && (
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
                                                return <li key={user.id}>
                                                    <input type="checkbox" value={user.id} id={`user-${user.id}`}
                                                           onChange={() => handleCheckedUser(user)}/>&nbsp;
                                                    <label htmlFor={`user-${user.id}`}> {user.username}</label></li>
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
            )}
        </>
    )
}

export default Home;