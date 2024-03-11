import {useEffect, useState} from "react";
import {userIF} from "../scripts/WebRTCPeerConnection.ts";

interface UserListProps {
    self: userIF;
    connectedUsers: userIF[];
}

const UserList = ({self, connectedUsers}: UserListProps) => {
    const [users, setUsers] = useState<userIF[] | []>([]);

    useEffect(() => {
        // console.log("Connected users: " + JSON.stringify(connectedUsers));
        setUsers(connectedUsers);
    }, [connectedUsers]);

    return (
        <div id="users">
            <h3>Utilisateurs</h3>
            <ul id="users-list">
                {users.map((user: userIF, index: number) => {
                    if (user.id === self.id) return;
                    return <li key={index} title={user.connected ? "Connecté" : "Déconnecté"}
                               className={"open-discussion" + (user.connected ? " connected" : " disconnected")}>
                        {user.username}
                    </li>

                })}
            </ul>
        </div>
    )
}

export default UserList
