import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {socketConn} from "../Socket/socket.ts";
import {DiscussionIF, DiscussionsIF, userIF} from "../Interfaces/Interfaces.ts";

interface DiscussionProps {
    createDiscussion: () => void;
    connectedUsers: userIF[];
    self: userIF;
}

const DiscussionsList = ({createDiscussion, connectedUsers, self}: DiscussionProps) => {
    const [discussions, setDiscussions] = useState<DiscussionsIF | object>({});

    useEffect(() => {
        socketConn.emit("get_liste_discussions");
    }, []);

    useEffect(() => {
        socketConn.on("liste_discussions", (data) => {
            // console.log("Liste de discussions: " + JSON.stringify(data));
            setDiscussions(data);
        });

        socketConn.on('nouvelle_discussion', (data: DiscussionIF) => {
            setDiscussions((currentDiscussions: DiscussionsIF) => ({...currentDiscussions, ...data}));
        });

        return () => {
            socketConn.off("liste_discussions");
            socketConn.off("nouvelle_discussion");
        };
    }, [socketConn]);

    return (
        <div id="discussions">
            <h3>Discussions</h3>
            <button id={"new-discussion"} onClick={createDiscussion}>Nouvelle discussion</button>
            <ul id="discussions-list">
                {Object.values(discussions).length === 0 && <li>Aucune discussion</li>}
                {Object.values(discussions).map((discussion: DiscussionIF, index: number) => {
                    if (discussion.name === "" && discussion.members.length === 2) {
                        const otherUser = connectedUsers.find((user) => user.uuid !== self.uuid)?.username || "Utilisateur inconnu";
                        return <li key={index}><Link
                            className={"open-discussion"}
                            to={`/discussion/${discussion.uuid}`}>Discussion avec {otherUser}</Link>
                        </li>
                    }
                    return <li key={index}><Link
                        className={"open-discussion"}
                        to={`/discussion/${discussion.uuid}`}>{discussion.name}</Link>
                    </li>
                })}
            </ul>
        </div>
    )
}

export default DiscussionsList
