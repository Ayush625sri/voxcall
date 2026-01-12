"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Contact, ContactRequest } from "@/types";
import { Phone, Trash2, Video } from "lucide-react";

export default function ContactsList() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sentRequests, setSentRequests] = useState<ContactRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ContactRequest[]>(
    []
  );
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    const contactsUnsub = onSnapshot(
      query(collection(db, "contacts"), where("userId", "==", user.uid)),
      (snapshot) => {
        const contactsData = snapshot.docs.map((doc) => ({
          uid: doc.data().contactUid,
          email: doc.data().email,
          displayName: doc.data().displayName,
          photoURL: doc.data().photoURL || "",
          addedAt: doc.data().addedAt?.toDate(),
          status: doc.data().status,
        })) as Contact[];
        setContacts(contactsData);
      }
    );

    const sentUnsub = onSnapshot(
      query(
        collection(db, "contactRequests"),
        where("fromUid", "==", user.uid)
      ),
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        })) as ContactRequest[];
        setSentRequests(requests);
      }
    );

    const receivedUnsub = onSnapshot(
      query(
        collection(db, "contactRequests"),
        where("toUid", "==", user.uid),
        where("status", "==", "pending")
      ),
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        })) as ContactRequest[];
        setReceivedRequests(requests);
      }
    );

    return () => {
      contactsUnsub();
      sentUnsub();
      receivedUnsub();
    };
  }, [user]);

const sendRequest = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) return;

  setLoading(true);
  setError("");

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      setError("User not found");
      return;
    }

    const targetUser = querySnapshot.docs[0].data();

    if (targetUser.uid === user.uid) {
      setError("Cannot add yourself");
      return;
    }

    // Check if already in contacts
    const contactQuery = query(
      collection(db, "contacts"),
      where("userId", "==", user.uid),
      where("contactUid", "==", targetUser.uid)
    );
    const existingContactSnap = await getDocs(contactQuery);
    if (!existingContactSnap.empty) {
      setError("Already in contacts");
      return;
    }

    // Check for any pending/active requests FROM this user TO target
    const sentRequestQuery = query(
      collection(db, "contactRequests"),
      where("fromUid", "==", user.uid),
      where("toUid", "==", targetUser.uid),
      where("status", "==", "pending")
    );
    const sentRequestSnap = await getDocs(sentRequestQuery);
    if (!sentRequestSnap.empty) {
      setError("Request already sent");
      return;
    }

    // Check for any pending requests FROM target TO this user
    const receivedRequestQuery = query(
      collection(db, "contactRequests"),
      where("fromUid", "==", targetUser.uid),
      where("toUid", "==", user.uid),
      where("status", "==", "pending")
    );
    const receivedRequestSnap = await getDocs(receivedRequestQuery);
    if (!receivedRequestSnap.empty) {
      setError("This user already sent you a request. Check your requests.");
      return;
    }

    const requestData: Omit<ContactRequest, "id"> = {
      fromUid: user.uid,
      fromEmail: user.email,
      fromDisplayName: user.displayName,
      toUid: targetUser.uid,
      toEmail: targetUser.email,
      status: "pending",
      createdAt: new Date(),
    };

    await addDoc(collection(db, "contactRequests"), requestData);
    setEmail("");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to send request");
  } finally {
    setLoading(false);
  }
};

  const acceptRequest = async (request: ContactRequest) => {
    if (!user) return;

    try {
      const contactData = {
        userId: user.uid,
        contactUid: request.fromUid,
        email: request.fromEmail,
        displayName: request.fromDisplayName,
        photoURL: "",
        addedAt: new Date(),
        status: "active",
      };

      const reverseContactData = {
        userId: request.fromUid,
        contactUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: "",
        addedAt: new Date(),
        status: "active",
      };

      await Promise.all([
        addDoc(collection(db, "contacts"), contactData),
        addDoc(collection(db, "contacts"), reverseContactData),
        updateDoc(doc(db, "contactRequests", request.id), {
          status: "accepted",
        }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept request");
    }
  };

  const declineRequest = async (request: ContactRequest) => {
    try {
      await updateDoc(doc(db, "contactRequests", request.id), {
        status: "declined",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to decline request"
      );
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "contactRequests", requestId), {
        status: "cancelled",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel request");
    }
  };

  const removeContact = async (contactUid: string) => {
    if (!user) return;

    try {
      const q1 = query(
        collection(db, "contacts"),
        where("userId", "==", user.uid),
        where("contactUid", "==", contactUid)
      );
      const snapshot1 = await getDocs(q1);

      const q2 = query(
        collection(db, "contacts"),
        where("userId", "==", contactUid),
        where("contactUid", "==", user.uid)
      );
      const snapshot2 = await getDocs(q2);

      await Promise.all([
        ...snapshot1.docs.map((d) => deleteDoc(d.ref)),
        ...snapshot2.docs.map((d) => deleteDoc(d.ref)),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove contact");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={sendRequest} className="flex gap-2">
        <input
          type="email"
          placeholder="Send contact request by email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 px-4 py-2 border rounded-lg text-gray-500 focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Request"}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {receivedRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-gray-900">
            Contact Requests ({receivedRequests.length})
          </h3>
          {receivedRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-500">
                  {request.fromDisplayName}
                </p>
                <p className="text-sm text-gray-500">{request.fromEmail}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => acceptRequest(request)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Accept
                </button>
                <button
                  onClick={() => declineRequest(request)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold text-lg text-gray-900">
          Contacts ({contacts.length})
        </h3>
        {contacts.length === 0 ? (
          <p className="text-gray-500">No contacts yet</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.uid}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {contact.displayName}
                  </p>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    title="Voice Call"
                  >
                    <Phone className="w-4" />
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    title="Video Call"
                  >
                    <Video className="w-4" />
                  </button>
                  <button
                    onClick={() => removeContact(contact.uid)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    title="Remove contact"
                  >
                    <Trash2 className="w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sentRequests.filter((r) => r.status === "pending").length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-gray-600">
            Pending Requests
          </h3>
          {sentRequests
            .filter((r) => r.status === "pending")
            .map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <p className="text-sm text-gray-600">
                  Request sent to {request.toEmail}
                </p>
                <button
                  onClick={() => cancelRequest(request.id)}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
