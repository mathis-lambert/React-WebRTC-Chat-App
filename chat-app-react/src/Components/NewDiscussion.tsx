import {userID, userIF} from "../Interfaces/Interfaces.ts";
import {useState} from "react";
import {socketConn} from "../Socket/socket.ts";

interface NewDiscussionIF {
    createDiscussion: boolean;
    setCreateDiscussion: (bool: boolean) => void;
    connectedUsers: userIF[];
    self: userIF;
    setSpeakingTo: (user: string) => void;
}

const NewDiscussion = ({
                           createDiscussion,
                           setCreateDiscussion,
                           connectedUsers,
                           self,
                           setSpeakingTo
                       }: NewDiscussionIF) => {
    const [createDiscussionName, setCreateDiscussionName] = useState<string>("");
    const [createDiscussionUsers, setCreateDiscussionUsers] = useState<userIF[]>([]);

    function handleCheckedUser(user: userIF) {
        if (createDiscussionUsers.find((u) => u.uuid === user.uuid)) {
            setCreateDiscussionUsers(createDiscussionUsers.filter((u) => u.uuid !== user.uuid));
        } else {
            setCreateDiscussionUsers([...createDiscussionUsers, user]);
        }
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
        setSpeakingTo(createDiscussionName)
    }


    return (
        <>
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
        </>
    )
}

export default NewDiscussion