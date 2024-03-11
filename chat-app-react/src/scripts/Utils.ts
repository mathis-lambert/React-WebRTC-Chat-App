import {socketConn} from "../Socket/socket.ts";

const sendOffer = (offer: RTCSessionDescriptionInit, to: string) => {
    socketConn.emit("offer", JSON.stringify({offer, to}));
}