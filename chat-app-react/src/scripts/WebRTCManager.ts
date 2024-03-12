import {Socket} from "socket.io-client";
import {PeersIF, ReceiveAnswerIF, ReceiveIceCandidateIF, ReceiveOfferIF, userIF} from "../Interfaces/Interfaces.ts";

interface callbacksIF {
    setRemoteStreams: (streams: MediaStream[]) => void;
    acceptIncomingCall: (offer: ReceiveOfferIF) => void;
    setInCall: (inCall: boolean) => void;
    setIsSharingScreen: (isSharing: boolean) => void;
    setConnectionState: (state: string) => void;
    setCalling: (calling: boolean) => void;
}

type SocketID = string;
type DiscussionID = string;

class WebRTCManager {
    config: RTCConfiguration = {
        iceServers: [{urls: "stun:stun.l.google.com:19302"}]
    }
    socket: Socket;
    self: userIF;
    connectedUsers: userIF[];
    peers: PeersIF = {};
    callbacks: callbacksIF;
    localStream: MediaStream;
    localScreen: MediaStream;
    remoteStreams: MediaStream[] = [];
    discussion: DiscussionID;
    type: 'video' | 'audio' = 'video';
    pendingIceCandidates: { [key: SocketID]: RTCIceCandidate[] } = {};
    callMembers: string[] = [];
    connectedMembers: string[] = [];
    callAccepted: boolean = false;

    verbose: boolean = true;

    constructor(socket: Socket, self: userIF, connectedUsers: userIF[], callbacks: callbacksIF) {

        if (!self) throw new Error("Self is not defined");

        this.config = {iceServers: [{urls: "stun:stun.l.google.com:19302"}]}
        this.socket = socket;
        this.self = self;
        this.connectedUsers = connectedUsers;
        this.peers = {};
        this.callbacks = callbacks;
        this.localStream = new MediaStream();
        this.localScreen = new MediaStream();

        this.remoteStreams = [];
        this.discussion = "";

        this.init();

        if (this.verbose) {
            console.log("WebRTCManager initialized: ")

            // setInterval(() => {
            //     console.log("Peers: ");
            //     console.log(this.peers);
            // }, 1000);
        }
    }

    init = () => {
        /**
         *  Initialize the WebRTCManager by setting up the socket event listeners
         *
         * @param void
         * @returns void
         */
        this.socket.on("receive_offer", this.handleOffer);
        this.socket.on("receive_answer", this.handleAnswer);
        this.socket.on("receive_ice_candidate", this.handleIceCandidate);
        this.socket.on("hang_up", this.endCall);
        this.socket.on("call_connected_users", (data) => {
            console.log("Connected users: ", data);
            this.connectedMembers = data.connected_users;
            this.discussion = data.discussion;
        });
    }

    newPeerConnection = async (socketId: string) => {
        /**
         * Create a new peer connection for the given socketId and add the local stream to it.
         *
         * @param socketId - The socketId of the user to connect to
         * @param type - The type of call (video or audio)
         *
         * @returns Promise<void>
         */
        if (this.peers[socketId]) return;

        if (this.verbose) console.log("Creating new peer connection for: ", socketId);

        this.peers[socketId] = new RTCPeerConnection(this.config);

        this.peers[socketId].ontrack = (event) => {
            if (this.verbose) {
                console.log("Received remote stream: ", event.streams[0]);
                event.streams[0].getTracks().forEach(track => {
                    console.log(`Track kind: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
                });
            }
            if (this.remoteStreams.includes(event.streams[0])) return;
            this.remoteStreams.push(event.streams[0]);
            this.callbacks.setRemoteStreams([...this.remoteStreams]);
        }

        this.peers[socketId].onicecandidate = (event) => {
            if (event.candidate) {
                if (this.verbose) console.log("Sending ice candidate: ", event.candidate);
                this.socket.emit('send_ice_candidate', {
                    target: socketId,
                    candidate: event.candidate,
                    discussion: this.discussion
                });
            }
        }

        this.peers[socketId].oniceconnectionstatechange = () => {
            console.log(`Connection state change: ${this.peers[socketId].iceConnectionState}`);

            this.callbacks.setConnectionState(this.peers[socketId].iceConnectionState);

            if (this.peers[socketId].iceConnectionState === "connected") {
                this.callbacks.setCalling(false);
                this.callbacks.setInCall(true);
            }

            if (this.peers[socketId].iceConnectionState === "failed") {
                this.endCall();
            }

            if (this.peers[socketId].iceConnectionState === "disconnected") {
                this.endCall();
            }
        };
    }

    addStreamTrack = async (type: 'video' | 'audio') => {
        await this.getLocalStream(type);
        if (!this.peers) console.warn("No peer connections to add stream to");

        this.localStream.getTracks().forEach(track => {
            for (const peer in this.peers) {
                console.log("Adding track to peer: ", peer);
                this.peers[peer].addTrack(track, this.localStream);
            }
        });
    }

    createOffer = async (members: string[], discussion: string, type: 'video' | 'audio', initiator: string) => {
        /**
         * For each member in the discussion, create a new peer connection and send an offer
         * to the member.
         *
         * @param members - The members of the discussion
         * @param type - The type of call (video or audio)
         *
         * @returns Promise<void>
         */
        this.setDiscussion(discussion);
        this.type = type;
        for (const member of members) {
            if (member === this.self.id) continue;
            if (this.peers[member]) continue;

            await this.newPeerConnection(member);
            await this.addStreamTrack(type);
            const offer = await this.peers[member].createOffer();
            await this.peers[member].setLocalDescription(offer);
            this.socket.emit('send_offer', {
                target: member,
                offer,
                type: type,
                discussion: discussion,
                members: members,
                initiator: initiator
            });
        }
    }

    getLocalStream = async (type: 'video' | 'audio') => {
        /**
         * Get the local stream for the given type (video or audio) and set it in the localStream
         *
         * @param type - The type of call (video or audio)
         *
         * @returns Promise<void>
         */
        try {
            if (this.verbose) console.log("Getting local stream: ", type);

            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: type === 'audio' || type === 'video'
            });
        } catch (e) {
            console.error("Error getting local stream: ", e);
        }
    }

    getLocalScreen = async () => {
        try {
            this.localScreen = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
        } catch (e) {
            console.error("Error getting local screen: ", e);
        }
    }

    shareScreen = async () => {
        await this.getLocalScreen();
        if (!this.peers) console.warn("No peer connections to add stream to");

        for (const peer in this.peers) {
            const senders = this.peers[peer].getSenders().find(sender => sender.track ? sender.track.kind === 'video' : false);

            if (senders) {
                await senders.replaceTrack(this.localScreen.getVideoTracks()[0]);
            } else {
                this.localScreen.getTracks().forEach(track => {
                    console.log("Adding track to peer: ", peer);
                    this.peers[peer].addTrack(track, this.localScreen);
                });
            }
        }

        this.callbacks.setIsSharingScreen(true);
    }

    stopSharingScreen = async () => {
        if (!this.localScreen) return;

        if (this.verbose) console.log("Stopping screen share");

        for (const peer in this.peers) {
            const senders = this.peers[peer].getSenders().find(sender => sender.track ? sender.track.kind === 'video' : false);
            if (senders) {
                await senders.replaceTrack(this.localStream.getVideoTracks()[0]);
            }
        }

        this.localScreen.getTracks().forEach(track => track.stop());
        this.localScreen = new MediaStream();
        this.callbacks.setIsSharingScreen(false);
    }

    handleOffer = async (offer: ReceiveOfferIF) => {
        /**
         * Handle an incoming offer by creating a new peer connection and setting the remote description
         *
         * @param offer - The offer to handle
         *
         * @returns Promise<void>
         */
        if (this.verbose) console.log("Received offer: ", offer.offer);
        if (this.peers[offer.sender]) {
            console.warn("Peer connection already exists for: ", offer.sender);
            return;
        }

        this.connectedMembers = offer.connected_users;

        if (offer.initiator === offer.sender && !this.callAccepted) {
            if (this.verbose) console.log("Offer initiator is the sender: ", offer.sender);

            await this.newPeerConnection(offer.sender);
            this.setDiscussion(offer.discussion);
            this.type = offer.type;
            this.callMembers = offer.members;
            this.callbacks.acceptIncomingCall(offer);

        } else if (this.callAccepted) {
            if (this.verbose) console.log("Call already accepted, receiving offer from another user: ", offer.sender);

            await this.newPeerConnection(offer.sender);
            await this.acceptIncomingCall(true, offer);
        } else {
            if (this.verbose) console.log("Call not accepted, rejecting offer from: ", offer.sender);

            this.socket.emit('reject_offer', {target: offer.sender});
        }
    }

    acceptIncomingCall = async (accepted: boolean, offer: ReceiveOfferIF) => {
        /**
         * Accept an incoming call by creating a new peer connection and setting the remote description
         *
         * @param offer - The offer to accept
         *
         * @returns Promise<void>
         */
        if (this.verbose) console.log("Accepting incoming call: ", offer.offer);

        this.callAccepted = accepted;

        if (!accepted) {
            this.socket.emit('reject_offer', {target: offer.sender});
            this.peers[offer.sender].close();
            delete this.peers[offer.sender];
            return;
        }

        await this.addStreamTrack(offer.type);
        await this.peers[offer.sender].setRemoteDescription(offer.offer);
        const answer = await this.peers[offer.sender].createAnswer();
        await this.peers[offer.sender].setLocalDescription(answer);
        await this.handlePendingIceCandidates(offer.sender); // Handle any pending ice candidates
        this.callbacks.setInCall(true);
        this.socket.emit('send_answer', {target: offer.sender, answer: answer, discussion: this.discussion});

        for (const member of this.connectedMembers) {
            if (member === this.self.id) continue;
            if (member === offer.sender) continue;
            if (this.peers[member]) continue;
            console.log("Creating offer for connected member: ", member);
            await this.createOffer(this.callMembers, this.discussion, this.type, this.self.id);
        }
    }

    handleAnswer = async (answer: ReceiveAnswerIF) => {
        /**
         * Handle an incoming answer by setting the remote description
         *
         * @param answer - The answer to handle
         *
         * @returns Promise<void>
         */
        if (this.verbose) console.log("Setting remote description: ", answer.answer);
        if (!this.peers[answer.sender]) {
            console.warn("No peer connection for: ", answer.sender);
            return;
        }
        this.callbacks.setInCall(true);
        await this.peers[answer.sender].setRemoteDescription(answer.answer);
    }

    handleIceCandidate = async (data: ReceiveIceCandidateIF) => {
        /**
         * Handle an incoming ice candidate by adding it to the peer connection
         *
         * @param candidate - The ice candidate to handle
         *
         * @returns Promise<void>
         */
        try {
            const candidate = new RTCIceCandidate(data.candidate);
            if (!this.pendingIceCandidates[data.sender]) this.pendingIceCandidates[data.sender] = [];
            this.pendingIceCandidates[data.sender].push(candidate);

            if (this.peers[data.sender] && this.peers[data.sender].remoteDescription) {
                await this.handlePendingIceCandidates(data.sender);
            }
        } catch (e) {
            console.error("Error adding ice candidate: ", e);
        }
    }

    handlePendingIceCandidates = async (socketId: string) => {
        /**
         * Once the peer connection is created, handle any pending ice candidates
         *
         * @param socketId - The socketId of the peer
         *
         * @returns Promise<void>
         */

        if (this.pendingIceCandidates[socketId]) {
            for (const candidate of this.pendingIceCandidates[socketId]) {
                if (this.verbose) console.log("Adding pending ice candidate: ", candidate, " to peer: ", this.peers[socketId]);
                if (this.peers[socketId].remoteDescription) {
                    await this.peers[socketId].addIceCandidate(candidate);
                } else {
                    console.warn("Remote description not set, adding ice candidate to pending: ", candidate);
                }
            }
            delete this.pendingIceCandidates[socketId];
        } else {
            if (this.verbose) console.warn("No pending ice candidates for: ", socketId);
        }
    }


    endCall = async () => {
        /**
         * End the call by closing the peer connection for each peer
         *
         * @param void
         *
         * @returns void
         */

        // Close the local stream
        this.localStream.getTracks().forEach(track => track.stop());
        this.localScreen.getTracks().forEach(track => track.stop());

        for (const peer in this.peers) {
            this.peers[peer].close();
            delete this.peers[peer];
        }

        this.reset();
    }

    reset = () => {
        this.localStream = new MediaStream();
        this.localScreen = new MediaStream();
        this.remoteStreams = [];
        this.discussion = "";
        this.type = 'video';
        this.pendingIceCandidates = {};
        this.callMembers = [];
        this.connectedMembers = [];
        this.callAccepted = false;
        this.callbacks.setInCall(false);
        this.callbacks.setIsSharingScreen(false);
        this.callbacks.setRemoteStreams([]);
    }

    setDiscussion = (discussion: string) => {
        this.discussion = discussion;
    }

    setConnectedUsers = (connectedUsers: userIF[]) => {
        this.connectedUsers = connectedUsers;
    }
}

export default WebRTCManager;