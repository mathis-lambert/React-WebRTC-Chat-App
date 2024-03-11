import {Socket} from "socket.io-client";
import {socketConn} from "../Socket/socket.ts";
import {
    ConstraintsIF,
    OfferRejectedIF,
    ReceiveAnswerIF,
    ReceiveIceCandidateIF,
    ReceiveOfferIF,
    SendAnswerIF,
    SendIceCandidateIF,
    SendOfferIF,
    userIF
} from "../Interfaces/Interfaces.ts";

interface WebRTCPeerConnectionIF {
    verbose: boolean;
    socket: Socket;
    callbacks: CallbacksIF;
    // localVideo: HTMLVideoElement;
    // localScreenSharing: HTMLVideoElement;
    // remoteVideo: HTMLVideoElement;
    // callStatusElement: HTMLElement;
    // callButtons: HTMLElement;
    // screenRecordingOverlay: HTMLElement;
    // stopSharingElement: HTMLElement;
    // shareScreenElement: HTMLElement;
    servers: { iceServers: { urls: string }[] };
    connectedUsers: userIF[];
    iceCandidatesQueue: RTCIceCandidate[];
    localStream: MediaStream;
    remoteStreams: MediaStream[];
    peerId: string | null;
    discutions_uuid: string;
    remotesPeersConnections: RTCPeerConnection[]
    constraints: ConstraintsIF;
    mediaRecorder: null;
    incall: boolean;
    waitingForAnswer: boolean;
    screenSharing: boolean;
    initialize: () => void;
    getLocalMedia: (constraints: ConstraintsIF, type: string) => void;
    setupMediaDevices: () => void;
    // bindEventListeners: () => void;
    updateSources: () => void;
    clearSelectOptions: (selectElement: HTMLSelectElement) => void;
    onSourceChange: (selectElement: HTMLSelectElement, type: 'video' | 'audio' | 'screen') => void;
    shareScreen: () => void;
    stopSharing: () => void;
    updateResolutions: () => void;
    createPeerConnection: (peerId: string) => void;
    call: (peerId: string, type: string, constraints: ConstraintsIF) => void;
    handleOffer: (data: ReceiveOfferIF) => void;
    showCallAcceptanceDialog: (data: ReceiveOfferIF) => void;
    handleAcceptCall: (data: ReceiveOfferIF, accepted: boolean) => void;
    sendIceCandidates: (peerId: string) => void;
    handleAnswer: (data: ReceiveAnswerIF) => void;
    handleCandidate: (data: ReceiveIceCandidateIF) => void;
    addIceCandidate: (candidate: RTCIceCandidate) => void;
    closeConnection: () => void;
    updateConnectedUsers: (connectedUsers: userIF[]) => void;

}


interface CallbacksIF {
    setLocalStream: (source: 'local', stream: MediaStream) => void;
    setRemoteStreams: (streams: MediaStream[]) => void;
    setScreenSharingStream: (source: 'screen', stream: MediaStream) => void;
    setIsScreenSharing: (status: boolean) => void;
    stopScreenSharing: () => void;
    setInCall: (status: boolean) => void;
    setCallStatus: (status: string) => void;
    setCallButtons: (status: boolean) => void;
    showCallAcceptanceDialog: (data: ReceiveOfferIF) => void;
    resetCallStatus: () => void;
}

class WebRTCPeerConnection implements WebRTCPeerConnectionIF {
    verbose: boolean;
    socket: Socket;
    callbacks: CallbacksIF;
    servers: { iceServers: { urls: string }[] };
    connectedUsers: userIF[];
    iceCandidatesQueue: RTCIceCandidate[];
    localStream: MediaStream;
    remoteStreams: MediaStream[];
    peerId: string | null;
    discutions_uuid: string;
    remotesPeersConnections: RTCPeerConnection[];
    constraints: ConstraintsIF;
    mediaRecorder: null;
    incall: boolean;
    waitingForAnswer: boolean;
    screenSharing: boolean;

    constructor(socket: Socket = socketConn, connectedUsers: userIF[], callbacks: CallbacksIF) {
        this.verbose = true;
        this.socket = socket;
        this.callbacks = callbacks;
        this.servers = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};
        this.connectedUsers = connectedUsers;
        this.iceCandidatesQueue = [];
        this.localStream = new MediaStream();
        this.remoteStreams = [];
        this.peerId = null;
        this.discutions_uuid = "";
        this.remotesPeersConnections = [];
        // this.iceCandidatesBuffer = [];

        this.constraints = {
            video: {
                width: {min: 1280},
                height: {min: 720},
                frameRate: {max: 60} // max 60 fps
            },
            audio: true
        };

        this.mediaRecorder = null;
        this.initialize();

        this.incall = false;
        this.waitingForAnswer = false;
        this.callbacks.setInCall(false);
        // todo: add a callback to handle the call status
        this.screenSharing = false;
    }

    initialize() {
        if (this.verbose) console.log('Initialisation de la connexion WebRTC...');

        this.socket.on('receive_offer', async (data: ReceiveOfferIF) => {
            await this.handleOffer(data);
        });

        this.socket.on('offer_rejected', (data: OfferRejectedIF) => {
            if (this.verbose) console.log("Offer rejected by: " + data.sender);
            this.closeConnection();
        })

        this.socket.on('hang_up', (data) => {
            if (this.verbose) console.log("Hang up by: " + data.sender);
            this.closeConnection();
        })

        this.setupMediaDevices();
        // this.bindEventListeners();
    }

    async getLocalMedia(constraints: ConstraintsIF, type = 'video') {
        try {
            // Arrêter les tracks du flux local existant pour éviter les fuites de ressources
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            if (this.verbose) console.log('Getting local media with constraints:', constraints, 'and type:', type);

            let stream;
            if (type === 'screen') {
                // Pour le partage d'écran, utilisez getDisplayMedia
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            } else if (type === 'video' || type === 'audio') {
                // Pour la vidéo et l'audio, utilisez getUserMedia
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            // Vérification pour s'assurer que le flux est reçu
            if (!stream || (type === 'video' && stream.getVideoTracks().length === 0) || (type === 'audio' && stream.getAudioTracks().length === 0)) {
                console.error(`No ${type} stream received.`);
                return;
            }

            if (this.verbose) console.log('Received local stream:', stream);

            // Mettre à jour l'état localStream avec le nouveau flux
            this.localStream = stream;
            // Mettre à jour la source vidéo locale pour afficher le nouveau flux
            this.callbacks.setLocalStream('local', stream);
            // if (this.localVideo) {
            //     this.localVideo.srcObject = stream;
            //     this.localVideo.play().catch(console.error); // Assurez-vous que la vidéo commence à jouer
            //     if (this.verbose) console.log('Local video element updated with new stream:', this.localVideo.srcObject);
            // }

            // // Gérer l'affichage des éléments de l'UI en fonction du type de flux
            // const videoContainer = document.querySelector<HTMLElement>('#video-container');
            // const messageScroller = document.querySelector<HTMLElement>('.message-scroller');
            // if (type === 'screen') {
            //     videoContainer?.classList.remove('hidden');
            //     messageScroller?.classList.add('hidden');
            // } else if (type === 'video') {
            //     videoContainer?.classList.remove('hidden');
            //     messageScroller?.classList.add('hidden');
            // } else if (type === 'audio') {
            //     videoContainer?.classList.add('hidden');
            //     messageScroller?.classList.remove('hidden');
            // }

            // Mettre à jour l'état de l'interface utilisateur via les rappels
            if (type === 'video') {
                this.callbacks.setLocalStream('local', stream);
            } else if (type === 'screen') {
                this.callbacks.setScreenSharingStream('screen', stream);
            }
        } catch (error) {
            console.error('Error accessing media:', error);
        }
    }


    setupMediaDevices() {
        // this.updateSources();
        // this.updateResolutions();
        // Ajoutez plus de configurations initiales si nécessaire
    }

    // bindEventListeners() {
    //     // Liez ici les gestionnaires d'événements pour les boutons et autres éléments d'interface utilisateur
    //     // Exemple pour démarrer la capture média
    //     document.querySelector<HTMLElement>('button#startButton').onclick = () => this.getLocalMedia(this.constraints);
    // }

    async updateSources() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            const audioInputs = devices.filter(device => device.kind === 'audioinput');

            const videoSourceSelect = document.getElementById('video-source') as HTMLSelectElement;
            const audioSourceSelect = document.getElementById('audio-source') as HTMLSelectElement;

            if (!videoSourceSelect || !audioSourceSelect) {
                console.error('No video or audio source select element found.');
                return;
            }

            this.clearSelectOptions(videoSourceSelect);
            this.clearSelectOptions(audioSourceSelect);

            videoInputs.forEach(device => {
                const option = new Option(device.label || `Camera ${videoSourceSelect.length + 1}`, device.deviceId);
                videoSourceSelect.appendChild(option);
            });

            audioInputs.forEach(device => {
                const option = new Option(device.label || `Microphone ${audioSourceSelect.length + 1}`, device.deviceId);
                audioSourceSelect.appendChild(option);
            });

            videoSourceSelect.onchange = () => this.onSourceChange(videoSourceSelect, 'video');
            audioSourceSelect.onchange = () => this.onSourceChange(audioSourceSelect, 'audio');
        } catch (error) {
            console.error('Error updating sources:', error);
        }
    }

    clearSelectOptions(selectElement: HTMLSelectElement) {
        while (selectElement.firstChild) {
            selectElement.removeChild(selectElement.firstChild);
        }
    }

    onSourceChange(selectElement: HTMLSelectElement, type: 'video' | 'audio' | 'screen') {
        const deviceId = selectElement.value;
        console.log('Selected ' + type + ' source:', deviceId);

        const constraints: ConstraintsIF = {...this.constraints};
        if (type === 'video') {
            constraints.video = {...constraints.video, deviceId: {exact: deviceId}};
        } else if (type === 'audio') {
            constraints.audio = {deviceId: {exact: deviceId}};
        }

        this.getLocalMedia(constraints, type).then(() => {
            if (this.remotesPeersConnections.length === 0) {
                console.error('No peer connection established.');
                return;
            }

            this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
                const tracks = this.localStream.getTracks().filter(track => track.kind === type);
                const senders = peer.getSenders().filter(sender => sender.track && sender.track.kind === type);

                senders.forEach((sender: RTCRtpSender) => {
                    if (this.verbose) console.log('Replacing ' + type + ' track:', sender.track);

                    const newTrack = tracks.find(track => {
                        if (this.verbose) console.log('Checking track:', track);
                        if (sender.track && track) {
                            return track.kind === sender.track.kind;
                        }
                    });
                    if (newTrack) {
                        sender.replaceTrack(newTrack).then(() => {
                            console.log(`${type} track replaced successfully.`);
                        }).catch(error => console.error(`Failed to replace ${type} track:`, error));
                    }
                });
            });
        }).catch(error => console.error(`Failed to get local media: ${error}`));
    }


    shareScreen() {
        if (!this.incall) {
            console.error('No call in progress');
            return;
        }

        navigator.mediaDevices.getDisplayMedia({video: true}).then(screenStream => {
            if (this.verbose) console.log('Screen sharing stream:', screenStream);

            if (this.remotesPeersConnections.length === 0) {
                console.error('No peer connection established.');
                return;
            }

            this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
                this.callbacks.setScreenSharingStream('screen', screenStream);
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = peer.getSenders().find(sender => {
                    if (sender.track && videoTrack) {
                        return sender.track.kind === videoTrack.kind;
                    }
                });

                if (sender && videoTrack) {
                    sender.replaceTrack(videoTrack).then(() => {
                        console.log('Screen sharing started.');
                        this.screenSharing = true;
                        this.callbacks.setIsScreenSharing(true);
                    }).catch(error => console.error('Failed to replace video track with screen sharing:', error));
                }

                // Optionally, handle stopping screen sharing
                videoTrack.onended = () => {
                    this.getLocalMedia(this.constraints).then(() => {
                        this.screenSharing = false;
                        console.log('Screen sharing stopped, back to camera.');
                    }).catch(error => console.error('Failed to switch back to camera:', error));
                };
            });
        }).catch(error => {
            console.error('Error getting screen sharing stream:', error);
        });
    }

    stopSharing() {
        if (this.screenSharing) {
            // Réinitialiser l'état de partage d'écran
            this.screenSharing = false;
            this.callbacks.setIsScreenSharing(false);

            // Basculer explicitement vers la caméra après avoir arrêté le partage d'écran
            this.getLocalMedia(this.constraints, 'video').then(() => {
                console.log('Screen sharing stopped. Switched back to camera.');

                if (this.remotesPeersConnections.length === 0) {
                    console.error('No peer connection established.');
                    return;
                }

                this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    const sender = peer.getSenders().find(sender => {
                        if (sender.track && videoTrack) {
                            return sender.track.kind === videoTrack.kind;
                        }
                    });

                    if (sender && videoTrack) {
                        sender.replaceTrack(videoTrack).then(() => {
                            console.log('Camera track replaced successfully.');
                        }).catch(error => console.error('Failed to replace video track with camera:', error));
                    }
                });

            }).catch(error => {
                console.error('Failed to switch back to camera:', error);
            });
        } else {
            console.log('Screen sharing is not active.');
        }
    }


    updateResolutions() {
        const resolutionsSelect = document.getElementById('resolutions') as HTMLSelectElement;

        // Prédéfinir quelques résolutions communes pour la sélection
        const resolutions = [
            {label: "HD 720p", width: 1280, height: 720},
            {label: "Full HD 1080p", width: 1920, height: 1080},
            {label: "UHD 4K", width: 3840, height: 2160}
        ];

        // Remplir le select avec les options de résolution
        this.clearSelectOptions(resolutionsSelect); // Réutilisation de la fonction clearSelectOptions définie précédemment
        resolutions.forEach(res => {
            const option = new Option(res.label, `${res.width}x${res.height}`);
            resolutionsSelect.appendChild(option);
        });

        // Gérer le changement de résolution
        resolutionsSelect.onchange = async () => {
            const [width, height] = resolutionsSelect.value.split('x');
            this.constraints.video.width.min = parseInt(width);
            this.constraints.video.height.min = parseInt(height);

            // Redémarrer la capture média avec les nouvelles contraintes
            await this.getLocalMedia(this.constraints);
        };
    }


    createPeerConnection(discussion_uuid: string) {
        this.iceCandidatesQueue = []; // Buffer pour stocker les candidats ICE
        this.discutions_uuid = discussion_uuid;

        const peer: RTCPeerConnection = new RTCPeerConnection(this.servers);
        this.remotesPeersConnections.push(peer);

        if (this.verbose) console.log('Created remote peer connection object remotePeerConnection:', peer);

        this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
            peer.onicecandidate = event => {
                if (event.candidate) {
                    console.log('Local ICE candidate:', event.candidate);
                    this.iceCandidatesQueue.push(event.candidate);
                    // Envoyer immédiatement le candidat ICE au pair distant
                    this.socket.emit('send_ice_candidate', {
                        target: discussion_uuid,
                        candidate: event.candidate
                    } as SendIceCandidateIF);
                } else {
                    console.log('All local ICE candidates have been generated.');
                }
            };
            if (!this.localStream) {
                console.error('Stream local manquant. Impossible d\'ajouter les tracks à la connexion peer-to-peer.');
                return;
            }

            peer.ontrack = event => {
                if (this.verbose) console.log('Remote peer connection received a stream:', event);
                event.streams.forEach((stream: MediaStream) => {
                    if (this.verbose) console.log('Adding remote stream:', stream);
                    this.remoteStreams.push(stream);
                });
                this.callbacks.setRemoteStreams(this.remoteStreams);
                this.incall = true;
                this.callbacks.setInCall(true);
                this.callbacks.setCallStatus("En communication");
            };

            this.localStream.getTracks().forEach(track => {
                if (this.verbose) console.log('Adding local track:', track);
                if (this.remotesPeersConnections.length === 0) {
                    console.error('No peer connection established.');
                    return;
                }
                peer.addTrack(track, this.localStream);
            });

            // Gestionnaire pour l'état de connexion ICE
            peer.oniceconnectionstatechange = () => {
                if (this.remotesPeersConnections.length === 0) {
                    console.error('No peer connection established.');
                    return;
                }

                if (this.verbose) console.log('ICE connection state change:', peer.iceConnectionState);

                if (peer.iceConnectionState === 'connected') {
                    console.log('Connexion établie.');
                }

                if (peer.iceConnectionState === 'disconnected' ||
                    peer.iceConnectionState === 'failed' ||
                    peer.iceConnectionState === 'closed') {
                    console.log('Le pair s\'est déconnecté.');
                    this.incall = false;
                    this.callbacks.setInCall(false);
                    this.closeConnection();
                }
            };
        });


    }

    async call(discussion_uuid: string, type: string = 'video', constraints: ConstraintsIF = this.constraints) {
        if (this.verbose) console.log('Calling discussion:', discussion_uuid, 'with type:', type);

        this.constraints = constraints;

        console.log('Calling with constraints:', this.constraints);

        await this.getLocalMedia(this.constraints, type)


        if (this.verbose) console.log('Media access granted. Creating peer connection...');


        this.createPeerConnection(discussion_uuid);

        if (this.remotesPeersConnections.length === 0) {
            console.error('No peer connection established.');
            return;
        }

        this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
            peer.createOffer().then(offer =>
                peer.setLocalDescription(offer)
            ).then(() => {
                this.socket.emit('send_offer', {
                    target: discussion_uuid,
                    offer: peer.localDescription,
                    type: type
                } as SendOfferIF);

                this.socket.on('receive_answer', (data) => {
                    if (this.verbose) console.log(`(Call) Received answer:`, data);
                    this.handleAnswer(data);
                });
            }).catch(error => console.error('Erreur création offre :', error));
        });

    }

    async handleOffer(data: ReceiveOfferIF) {
        if (this.verbose) console.log('Received offer:', data);

        // Afficher l'UI pour accepter/refuser l'appel

        // TODO: gérer l'acceptation/refus de l'appel
        // this.handleAcceptCall(data, true);
        this.discutions_uuid = data.discussion;
        this.showCallAcceptanceDialog(data);
    }

    showCallAcceptanceDialog(data: ReceiveOfferIF): void {
        if (this.verbose) console.log('Showing call acceptance dialog:', data);
        this.callbacks.showCallAcceptanceDialog(data)
        this.waitingForAnswer = true;
    }

    async handleAcceptCall(data: ReceiveOfferIF, accepted: boolean) {
        if (accepted) {
            if (this.verbose) console.log('Connexion acceptée. Tentative de création de réponse...');


            const result = this.connectedUsers.find((s: userIF) => s.id === data.sender);
            const caller_uuid: string | null = result ? result.uuid : null;

            window.history.pushState({}, "", `?to=${caller_uuid}`);

            if (this.verbose) console.log('Media access granted. Creating peer connection...');

            await this.getLocalMedia(this.constraints, data.type)

            this.createPeerConnection(data.sender);

            if (this.remotesPeersConnections.length === 0) {
                console.error('No peer connection established.');
                return;
            }

            this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
                // Dans handleAcceptCall après avoir créé une réponse
                peer.setRemoteDescription(new RTCSessionDescription(data.offer)).then(() => {
                    return peer.createAnswer();
                }).then(answer => {
                    return peer.setLocalDescription(answer as RTCSessionDescription);
                }).then(() => {
                    this.socket.emit('send_answer', {
                        target: data.sender,
                        answer: peer.localDescription
                    } as SendAnswerIF);

                    this.socket.on('receive_ice_candidate', async (data) => {
                        if (this.verbose) console.log(`(HandleAcceptCall) Received ICE candidate:`, data);
                        this.handleCandidate(data);
                    });
                }).catch(error => {
                    console.error('Erreur pendant la négociation WebRTC :', error);
                });
            });

        } else {
            console.log('Connexion refusée.');
            // Envoyer un message au pair émetteur pour lui dire que l'offre a été refusée
            this.socket.emit('offer_rejected', {target: data.sender});
            // Vous pourriez vouloir informer l'émetteur que la connexion a été refusée.
            // Cela nécessiterait une gestion supplémentaire côté serveur et émetteur.
        }
    }

// Ajoutez une nouvelle fonction pour envoyer tous les candidats ICE en attente
    sendIceCandidates() {
        console.log(`Sending ${this.iceCandidatesQueue.length} ICE candidates to discussion:`, this.discutions_uuid);
        while (this.iceCandidatesQueue.length > 0) {
            const candidate = this.iceCandidatesQueue.shift();
            this.socket.emit('send_ice_candidate', {
                target: this.discutions_uuid,
                candidate: candidate
            } as SendIceCandidateIF);
        }
    }

    handleAnswer(data: ReceiveAnswerIF) {
        if (this.verbose) console.log('Received answer:', data);

        if (this.remotesPeersConnections.length === 0) {
            console.error('No peer connection established.');
            return;
        }

        this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
            peer.setRemoteDescription(new RTCSessionDescription(data.answer))
                .then(() => {
                    console.log('Remote description set successfully');
                    this.sendIceCandidates(); // Assurez-vous que `data.sender` est l'ID du pair distant
                    this.socket.on('receive_ice_candidate', (data) => {
                        if (this.verbose) console.log(`(HandleAnswer) Received ICE candidate:`, data);
                        this.handleCandidate(data);
                    });

                    // this.processIceCandidatesBuffer(); // Traitez tous les candidats ICE bufferisés
                })
                .catch((err) => {
                    console.error('Error setting remote description:', err);
                });
        });
    }

    handleCandidate(data: ReceiveIceCandidateIF) {
        if (this.verbose) console.log('Received ICE candidate:', data);
        const candidate = new RTCIceCandidate(data.candidate);
        this.addIceCandidate(candidate);
    }

    addIceCandidate(candidate: RTCIceCandidate) {
        console.log('Adding ICE candidate:', candidate);

        if (this.remotesPeersConnections.length === 0) {
            console.error('No peer connection established.');
            return;
        }

        this.remotesPeersConnections.forEach((peer: RTCPeerConnection) => {
            peer.addIceCandidate(candidate).then(() => {
                console.log('ICE candidate ajouté avec succès:', candidate);
            }).catch(err => {
                console.error("Erreur lors de l'ajout d'un candidat ICE:", err);
            });
        });
    }

    closeConnection() {
        if (this.verbose) console.log('Closing WebRTC connection...');
        // Arrêter tous les tracks du stream local
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Fermer la connexion peer-to-peer si elle existe
        if (this.remotesPeersConnections.length > 0) {
            this.remotesPeersConnections.forEach(peer => {
                peer.close();
                this.remotesPeersConnections = [];
            });
            this.peerId = null;
            this.remoteStreams = [];
        }

        this.callbacks.setInCall(false);

        this.incall = false;
        // Optionnel : Nettoyer ou réinitialiser d'autres variables si nécessaire
        // Par exemple, réinitialiser les sélections d'interface utilisateur ou les contraintes
        // Cela dépend de la logique spécifique de votre application

        if (this.verbose) console.log('La connexion WebRTC a été fermée et les ressources nettoyées.');
    }

    updateConnectedUsers(connectedUsers: userIF[]) {
        this.connectedUsers = connectedUsers;
    }
}

export default WebRTCPeerConnection;
export type {
    WebRTCPeerConnectionIF,
    userIF,
    ConstraintsIF,
    ReceiveOfferIF,
    SendOfferIF,
    ReceiveAnswerIF,
    SendAnswerIF,
    ReceiveIceCandidateIF,
    SendIceCandidateIF,
    OfferRejectedIF
}