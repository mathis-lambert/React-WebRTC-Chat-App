import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {socketConn} from "../Socket/socket.ts";
import {DiscussionIF, DiscussionsIF, userIF} from "../Interfaces/Interfaces.ts";
import {useLocation} from "react-router-dom";

interface DiscussionProps {
    createDiscussion: () => void;
    connectedUsers: userIF[];
    self: userIF;
    setSpeakingTo: (user: string) => void;
}

const DiscussionsList = ({createDiscussion, connectedUsers, self, setSpeakingTo}: DiscussionProps) => {
    const [discussions, setDiscussions] = useState<DiscussionsIF | object>({});
    const [discussionId, setDiscussionId] = useState<string>("");

    const location = useLocation();

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
    }, []);

    useEffect(() => {
        setDiscussionId(location.pathname.split("/")[2]);
    }, [location.pathname]);

    return (
        <div id="discussions">
            <h3>Discussions</h3>
            <button id={"new-discussion"} onClick={createDiscussion}>Nouvelle discussion</button>
            <ul id="discussions-list">
                {Object.values(discussions).length === 0 && <li>Aucune discussion</li>}
                {Object.values(discussions).map((discussion: DiscussionIF, index: number) => {
                    const selected = discussion.uuid === discussionId ? "selected" : "";
                    if (discussion.name === "" && discussion.members.length === 2) {
                        const otherUser = connectedUsers.find((user) => user.uuid !== self.uuid && user.uuid === discussion.members.find((member) => member === user.uuid));
                        if (otherUser) {
                            return <li key={index}><Link
                                className={"open-discussion " + selected}
                                to={`/discussion/${discussion.uuid}`}
                                onClick={() => setSpeakingTo(otherUser.username)}
                            >{otherUser.username}</Link>
                            </li>
                        }
                    } else if (discussion.name === "" && discussion.members.length > 2) {
                        const otherUsers = discussion.members.filter((member) => member !== self.uuid).map((member) => connectedUsers.find((user) => user.uuid === member));
                        console.log(otherUsers);
                        return <li key={index}><Link
                            className={"open-discussion " + selected}
                            to={`/discussion/${discussion.uuid}`}
                            onClick={() => setSpeakingTo(otherUsers.map((user) => user ? user.username : "").join(", "))}
                        >{otherUsers.map((user) => user ? user.username : "").join(", ").substring(0, 20)}{otherUsers.length > 3 ? "..." : ""}</Link>
                        </li>
                    } else {
                        return <li key={index}><Link
                            className={"open-discussion " + selected}
                            to={`/discussion/${discussion.uuid}`}
                            onClick={() => setSpeakingTo(discussion.name)}
                        >{discussion.name}</Link>
                        </li>
                    }
                })}
            </ul>
        </div>
    )
}

export default DiscussionsList
