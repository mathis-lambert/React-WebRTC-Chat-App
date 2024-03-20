import {useEffect, useState} from "react";
import {userIF} from "../Interfaces/Interfaces";
import {UserMinus, UserPlus} from "react-feather";
import {socketConn} from "../Socket/socket.ts";

interface UserListProps {
    self: userIF;
    connectedUsers: userIF[];
    usersInCall?: userIF[];
    inCall: boolean;
    createOffer: (target: string) => void;
    isCallInitiator: boolean;
}

const UserList = ({self, connectedUsers, usersInCall, inCall, createOffer, isCallInitiator}: UserListProps) => {
    const [users, setUsers] = useState<userIF[] | []>([]);

    useEffect(() => {
        setUsers(connectedUsers);
    }, [connectedUsers]);

    const handleAddUserToCall = (user: userIF) => {
        console.log("Add user to call: " + user.username);

        socketConn.emit("add_user_to_call", {discussion: self.uuid, target: user.id});
        createOffer(user.id);
    }

    const handleRemoveUserFromCall = (user: userIF) => {
        console.log("Remove user from call: " + user.username);

        socketConn.emit("remove_user_from_call", {discussion: self.uuid, target: user.id});
    }

    return (
        <div id="users">
            <h3>Utilisateurs</h3>
            <ul id="users-list">
                {users.map((user: userIF, index: number) => {
                    return <li key={index} title={user.connected ? "Connecté" : "Déconnecté"}
                               className={"open-discussion" + (user.connected ? " connected " : " disconnected") + (user.id === self.id ? "self" : "")}>
                        <p>{user.username} {user.id === self.id ? "(Vous)" : ""}</p>
                        {user.id !== self.id && inCall && user.connected && isCallInitiator && (
                            <>
                                {(usersInCall?.includes(user)) && (
                                    <button className="action-button RemoveUserFromCall" disabled
                                            title={'Retirer l\'utilisateur de l\'appel'}
                                            onClick={() => handleRemoveUserFromCall(user)}><UserMinus/></button>
                                ) || (
                                    <button className="action-button AddUserToCall"
                                            title={'Ajouter l\'utilisateur à l\'appel'}
                                            onClick={() => handleAddUserToCall(user)}><UserPlus/></button>
                                )}
                            </>
                        )}
                    </li>
                })}
            </ul>
        </div>
    )
}

export default UserList
