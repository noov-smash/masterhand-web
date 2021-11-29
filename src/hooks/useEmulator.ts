import React from "react";
// Hooks
import { Context } from "./Provider";
import { useDatabase } from "./useDatabase";
import { useGamePad } from "./useGamePad";
// Interfaces
import { ContextProps, SignalProps } from "../interfaces";
import uid from "uniqid";
import rison from "rison";
import { BitlyClient } from "bitly";
const bitly = new BitlyClient(process.env.REACT_APP_BITLY_TOKEN || "");

export const useEmulator = () => {
  const [context, setContext] = React.useContext(Context);
  const [buffer, setBuffer] = React.useState<SignalProps[]>();
  const intervalRef = React.useRef<NodeJS.Timeout | null>();
  const { saveCommand, storeCommand, saveFile } = useDatabase();
  const { onPush, onTilt, neutral } = useGamePad();

  const bufferRef = React.useRef(buffer);
  React.useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  const recorderStart = React.useCallback( ():void => {
    if (!context.media.recorder) return
    context.media.recorder.ondataavailable = (e) => {
      const blob = new Blob([e.data], { type: e.data.type });
      setContext((c: ContextProps) => ({
        ...c,
        emulator: {
          ...c.emulator,
          command: {
            ...c.emulator.command,
            blob: blob,
          },
        },
      }));
    };
    context.media.recorder.start();
  }, [context.media.recorder, setContext])

  const recorderStop = React.useCallback( (): void => {
    if (!context.media.recorder) return
    context.media.recorder.stop();
  },[context.media.recorder])

  const stopRec = React.useCallback(async(): Promise<void> => {
    console.log("Stop...");
    recorderStop()
    setContext((c: ContextProps) => ({
      ...c,
      emulator: {
        ...c.emulator,
        state: "standby",
        command: {
          ...c.emulator.command,
          signals: c.emulator.command.signals?.concat([
            {
              t: Number(c.emulator.time.toFixed(2)),
              s: new Uint8Array([99, 0]),
            },
          ]),
        },
      },
    }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    neutral();
  }, [neutral, recorderStop, setContext]);

  const stopPlay = React.useCallback(
    async (reset?: boolean): Promise<void> => {
      console.log("Stop...");
      setContext((c: ContextProps) => ({
        ...c,
        emulator: reset
          ? { ...c.emulator, state: "standby", time: 0 }
          : { ...c.emulator, state: "standby" },
      }));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      neutral();
    },
    [neutral, setContext]
  );

  const stopAll = React.useCallback((): void => {
    if (
      context.emulator.state === "playing" ||
      context.emulator.state === "repeating"
    )
      stopPlay();
    if (context.emulator.state === "recording") stopRec();
  }, [context.emulator.state, stopPlay, stopRec]);

  const recInterval = React.useCallback((): void => {
    setContext((c: ContextProps) => ({
      ...c,
      emulator: {
        ...c.emulator,
        time: Number((c.emulator.time + 1 / 60).toFixed(2)),
      },
    }));
  }, [setContext]);

  const isTimeOver = React.useCallback(
    (time: number) => {
      const lastCommand =
        context.emulator.command.signals[
          context.emulator.command.signals.length - 1
        ];
      return lastCommand.t <= time;
    },
    [context.emulator.command.signals]
  );

  const playInterval = React.useCallback(async (): Promise<void> => {
    setContext((c: ContextProps) => {
      if (!bufferRef.current) return { ...c };
      const time = Number((c.emulator.time + 1 / 60).toFixed(2));
      const data = bufferRef.current.filter((b) => b.t === time);
      if (!data) return { ...c };
      Promise.all(
        data.map((d) => {
          if (d.s[0] <= 17) return onPush(d.s[0], d.s[1] === 1 ? true : false);
          else if (18 <= d.s[0] && d.s[0] <= 21) return onTilt(d.s[0], d.s[1]);
          return null;
        })
      );

      // If it over record time, stop timer
      if (isTimeOver(time)) {
        if (c.emulator.state === "playing") stopPlay(true);
        else if (c.emulator.state === "repeating") {
          setBuffer(context.emulator.command.signals);
          return {
            ...c,
            emulator: { ...c.emulator, state: "repeating", time: 0 },
          };
        }
      }
      return {
        ...c,
        emulator: {
          ...c.emulator,
          time: time,
        },
      };
    });
  }, [
    context.emulator.command.signals,
    isTimeOver,
    onPush,
    onTilt,
    setContext,
    stopPlay,
  ]);

  const rec = React.useCallback(async(): Promise<void> => {
    console.log("Rec...");
    recorderStart()
    setContext((c: ContextProps) => ({
      ...c,
      emulator: {
        ...c.emulator,
        state: "recording",
        time: 0,
        command: {
          ...c.emulator.command,
          signals: [],
        },
      },
    }));
    intervalRef.current = setInterval(recInterval, 1000 / 60);
  }, [recInterval, recorderStart, setContext]);

  const play = React.useCallback(
    async (repeat: boolean): Promise<void> => {
      console.log(repeat ? "Repeat..." : "Play...");
      setContext((c: ContextProps) => ({
        ...c,
        emulator: {
          ...c.emulator,
          state: repeat ? "repeating" : "playing",
          time: 0,
        },
      }));
      setBuffer(context.emulator.command.signals);
      intervalRef.current = setInterval(playInterval, 1000 / 60);
    },
    [context.emulator.command.signals, playInterval, setContext]
  );

  const save = React.useCallback(async (): Promise<void> => {
    if (!context.emulator.command.signals) return;
    console.log("Saving...", context.emulator.command.signals);
    try {
      // Upload Webm
      const data = context.emulator.command
      data.blob &&
        (data.videoUrl = await saveFile(
          `${data.id}.webm`,
          data.blob
        ));
      // AminUser
      if (context.user.isAdmin) {
        // Exist
        if (data.path) {
          await saveCommand(
            `${context.project.id}/${data.path}`,
            {
              id: data.id,
              title: data.title,
              path: data.path,
              data: data,
            }
          );
          window.alert("Updated");
        } else {
          // New
          const path = `${context.project.id}/${context.project.data.length}`;
          await saveCommand(path, {
            id: uid(),
            index: {
              title: "Untitled",
            },
            items: [
              {
                id: uid(),
                title: "Untitled",
                data: data,
              },
            ],
          });
          window.alert("Saved As New Data");
        }
      }
      // AnonymousUser
      else {
        if (!context.project.id) return;
        const storage = localStorage.getItem(
          `PhantomHand-${context.project.id}`
        );
        if (!storage || !context.project.data) return;
        const path: string[] = data.path.split("/");
        const newData: any = Array.from(context.project.data);
        if (path.length === 1 || !newData) return;
        if (path.length === 3) {
          newData[path[0]][path[1]][path[2]].data = data;
        } else if (path.length === 5) {
          newData[path[0]][path[1]][path[2]][path[3]][path[4]].data =
            data;
        }
        await storeCommand(context.project.id, newData);
        window.alert("Updated LocalStorage");
      }
    } catch (error) {
      window.alert("Failed");
      console.error(error);
    }
  }, [
    context.emulator.command,
    context.project.data,
    context.project.id,
    context.user.isAdmin,
    saveCommand,
    saveFile,
    storeCommand,
  ]);

  const share = React.useCallback(async (): Promise<void> => {
    try {
      const command = rison.encode(context.emulator.command.signals);
      const url = `${window.location.href
        .split(/[?#]/)[0]
        .replace("localhost", "127.0.0.1")}?data=${command}`;
      const bitlyLink = await bitly.shorten(url);
      const hashtags = "PhantomHand";
      window.open(
        `https://twitter.com/intent/tweet?&url=${bitlyLink.link}&hashtags=${hashtags}`,
        "_blank"
      );
    } catch (error) {
      window.alert("Error");
      console.error(error);
    }
  }, [context.emulator.command.signals]);

  return {
    rec,
    stopRec,
    play,
    stopPlay,
    save,
    share,
    stopAll,
    recorderStart,
    recorderStop,
  };
};
