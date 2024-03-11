import {io, Socket} from "socket.io-client";
export const socketConn: Socket = io("http://localhost:3001", {transports: ["websocket"]});