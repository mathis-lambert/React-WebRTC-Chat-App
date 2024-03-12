import {io, Socket} from "socket.io-client";

const uri = "http://localhost:3001";
export const socketConn: Socket = io(uri, {
    transports: ["websocket"],
    reconnection: true,
    path: "/api/socket.io",
    autoConnect: false
});