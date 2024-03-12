interface userIF {
    connected: boolean;
    id: string,
    username: string,
    uuid: string
}

type userID = string;
type socketID = string;
type discussionID = string;

interface MessageIF {
    username: string,
    id: socketID,
    text: string,
    to: socketID,
}
interface DiscussionIF {
    name: string,
    uuid: string,
    creator: userID,
    members: userID[],
    messages: MessageIF[],
    inCall: boolean
}

interface DiscussionsIF {
    [key: discussionID]: DiscussionIF
}

interface ConstraintsIF {
    video: {
        width: { min: number },
        height: { min: number },
        frameRate: { max: number },
        deviceId?: { exact: string },
    },
    audio: boolean | { deviceId?: { exact: string } } | undefined
}

interface ReceiveOfferIF {
    discussion: discussionID,
    sender: socketID,
    offer: RTCSessionDescription,
    pseudo_caller: string,
    type: 'video' | 'audio',
    members: socketID[],
    initiator: socketID,
    connected_users: socketID[]
}

interface SendOfferIF {
    target: string,
    offer: RTCSessionDescription,
    type: string
    discussion: string
}

interface ReceiveAnswerIF {
    sender: string,
    answer: RTCSessionDescription,
    discussion: string
}

interface SendAnswerIF {
    target: string,
    answer: RTCSessionDescription,
    discussion: string
}

interface ReceiveIceCandidateIF {
    sender: string,
    candidate: RTCIceCandidate
}

interface SendIceCandidateIF {
    target: string,
    candidate: RTCIceCandidate
}

interface OfferRejectedIF {
    sender: string
    target: string
}

interface PeersIF {
    [key: string]: RTCPeerConnection;
}


export type {
    userIF,
    userID,
    socketID,
    MessageIF,
    DiscussionIF,
    DiscussionsIF,
    ConstraintsIF,
    ReceiveOfferIF,
    SendOfferIF,
    ReceiveAnswerIF,
    SendAnswerIF,
    ReceiveIceCandidateIF,
    SendIceCandidateIF,
    OfferRejectedIF,
    PeersIF
}