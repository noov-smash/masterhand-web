import React from "react";
// Firebase
import firebase, { firestore, database } from "../configs/firebase";
// Interfaces
import {
  FirebaseProjectProps,
  SignedUserProps,
  FirebaseUserProps,
} from "../interfaces";
import { MenuGroupProps } from "../ui/systems/Navigation/MenuGroup";

// Context
import { Context } from "./Provider";

export const useDatabase = () => {
  const [, setContext] = React.useContext(Context);

  const fetchCommands = React.useCallback(
    async (projectId: string): Promise<MenuGroupProps | null> => {
      console.log("Fetching Commands...");
      try {
        const ref = database.ref(`${projectId}/`).orderByKey();
        let res;
        await ref.once("value", async (snapshot) => {
          res = await snapshot.val();
        });
        return res || null;
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const watchCommands = React.useCallback(
    async (projectId: string): Promise<void> => {
      console.log("Watch Commands...");
      try {
        const ref = database.ref(`${projectId}/`).orderByKey();
        ref.on("value", async (snapshot) => {
          const res = await snapshot.val();
          setContext((c) => ({
            ...c,
            project: {
              ...c.project,
              data: res,
            },
          }));
        });
      } catch (error) {
        throw error;
      }
    },
    [setContext]
  );

  const saveCommand = React.useCallback(
    async (path: string, data: any): Promise<void> => {
      try {
        await database.ref(path).set(data);
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const pushCommand = React.useCallback(
    async (path: string, data: any): Promise<void> => {
      try {
        await database.ref(path).push(data);
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const removeCommand = React.useCallback(
    async (path: string): Promise<void> => {
      try {
        await database.ref(path).remove();
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const fetchCommand = React.useCallback(async (path: string): Promise<any> => {
    try {
      const ref = database.ref(`${path}/`).orderByKey();
      let res;
      await ref.once("value", async (snapshot) => {
        res = await snapshot.val();
      });
      return res || null;
    } catch (error) {
      throw error;
    }
  }, []);

  const fetchProjects = React.useCallback(async (): Promise<
    FirebaseProjectProps[]
  > => {
    console.log("Fetching Projects...");
    try {
      const ref = await firestore.collection("Projects").orderBy("order").get();
      const res: FirebaseProjectProps[] = [];
      ref.forEach((doc) => {
        const data = doc.data();
        res.push({
          id: doc.id,
          name: data.name,
          ...doc.data(),
        });
      });
      return res;
    } catch (error) {
      throw error;
    }
  }, []);

  const fetchProject = React.useCallback(
    async (id: string): Promise<FirebaseProjectProps | null> => {
      console.log("Fetching Project...");
      try {
        const ref = await firestore.collection("Projects").doc(id).get();
        const data: firebase.firestore.DocumentData | undefined = ref.data();
        const commands = await fetchCommands(id);
        return data
          ? {
              id: data.id,
              name: data.name,
              imageUrl: data.imageUrl,
              commands: commands || [],
            }
          : null;
      } catch (error) {
        throw error;
      }
    },
    [fetchCommands]
  );

  const userConverter =
    React.useCallback((): firebase.firestore.FirestoreDataConverter<FirebaseUserProps> => {
      return {
        toFirestore(user: SignedUserProps) {
          return {
            ...user,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          };
        },
        fromFirestore(
          snapshot: firebase.firestore.QueryDocumentSnapshot,
          options: firebase.firestore.SnapshotOptions
        ): FirebaseUserProps {
          const data = snapshot.data(options)!;
          return {
            uid: data.uid,
            isAdmin: data.isAdmin,
          };
        },
      };
    }, []);

  /**
   * Firestoreからユーザーのデータを取得する
   * @param id ユーザーID
   */
  const fetchUser = React.useCallback(
    async (id: string): Promise<FirebaseUserProps | null> => {
      try {
        console.log("Fetching User...", id);
        const user = (
          await firestore
            .collection("Users")
            .doc(id)
            .withConverter(userConverter())
            .get()
        ).data();
        return user || null;
      } catch (error) {
        throw error;
      }
    },
    [userConverter]
  );

  /**
   * Firestoreにユーザーのデータを保存する
   * @param id ユーザーID
   */
  const saveUser = React.useCallback(
    async (user: FirebaseUserProps): Promise<void> => {
      try {
        console.log("Saving User to Firestore...");
        user.uid &&
          (await firestore
            .collection("Users")
            .doc(user.uid)
            .withConverter(userConverter())
            .set(user));
      } catch (error) {
        throw error;
      }
    },
    [userConverter]
  );

  return {
    fetchProjects,
    fetchProject,
    watchCommands,
    fetchCommands,
    saveCommand,
    pushCommand,
    fetchCommand,
    removeCommand,
    fetchUser,
    saveUser,
  };
};
