import React from "react";
import uid from "uniqid";
// Hooks
import { useDatabase } from "../../../hooks/useDatabase";
import { ProjectDataProps } from "../../../interfaces";
import { Context } from "../../../hooks/Provider";
// Interfaces
import { MenuGroupProps } from "../../../ui/systems/Navigation/MenuGroup";
import { MenuProps } from "../../../ui/systems/SideMenu/Menu";
import { NavFolderProps } from "../../../ui/parts/Navigation/NavFolder";
import { NavIndexProps } from "../../../ui/parts/Navigation/NavIndex";
import { NavItemProps } from "../../../ui/parts/Navigation/NavItem";
import { NeutralGamepadProps } from "../../../hooks/Provider";

export const useSideMenu = (props: MenuProps) => {
  type indexActionProps = {
    type: "index";
    groupIndex: number;
  };
  type folderActionProps = {
    type: "folder";
    groupIndex: number;
    folderIndex: number;
  };
  type itemActionProps = {
    type: "item";
    groupIndex: number;
    itemIndex: number;
  };
  type folderItemActionProps = {
    type: "folderItem";
    groupIndex: number;
    folderIndex: number;
    itemIndex: number;
  };
  type buttonActionProps =
    | indexActionProps
    | folderActionProps
    | itemActionProps
    | folderItemActionProps;
  const [menu, setMenu] = React.useState<MenuGroupProps[]>();
  const [context, setContext] = React.useContext(Context);
  const [activeItem, setActiveItem] = React.useState<string>();
  const { saveCommand, storeCommand } = useDatabase();
  const menuRef = React.useRef(menu);

  React.useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  const save = React.useCallback(
    async (data: MenuGroupProps[], notUpload?: boolean): Promise<void> => {
      console.log("Saving...", props.saveTo);
      setMenu(convert().toFormat(data));
      const saveData = convert().toRaw(data);
      if (props.saveTo === "storage") {
        if (!context.project.id) return;
        storeCommand(context.project.id, saveData, notUpload || false);
        return;
      } else if (
        props.saveTo === "db" &&
        props.isEditable &&
        context.user.isAdmin
      )
        await saveCommand(props.index.id, saveData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.saveTo,
      props.isEditable,
      props.index.id,
      context.user.isAdmin,
      context.project.id,
      saveCommand,
      storeCommand,
    ]
  );

  const saveName = React.useCallback(
    (
      action: buttonActionProps,
      e: React.ChangeEvent<HTMLInputElement>,
      prevRightButtons: NavIndexProps["_rightButtons"]
    ): void => {
      console.log("Saving Name....", props.saveTo);
      if (!menuRef.current) return;
      const newMenu = [...menuRef.current];
      const group = newMenu[action.groupIndex];
      const saveNameProps = {
        title: e.target.value,
        _isEditing: false,
        _rightButtons: prevRightButtons,
        _onClickOutside: () => {},
      };
      if (action.type === "index")
        group.index = {
          ...group.index,
          ...saveNameProps,
        };
      else if (action.type === "folder" && group.folders)
        group.folders[action.folderIndex] = {
          ...group.folders[action.folderIndex],
          ...saveNameProps,
        };
      else if (action.type === "item" && group.items) {
        group.items[action.itemIndex] = {
          ...group.items[action.itemIndex],
          ...saveNameProps,
        };
        if (group.items[action.itemIndex]._state === "active") {
          const title = group.items[action.itemIndex].title;
          setContext((c) => ({
            ...c,
            emulator: {
              ...c.emulator,
              command: {
                ...c.emulator.command,
                title: title,
              },
            },
          }));
        }
      } else if (action.type === "folderItem" && group.folders) {
        const folder = group.folders[action.folderIndex];
        if (folder.items) {
          folder.items[action.itemIndex] = {
            ...folder.items[action.itemIndex],
            ...saveNameProps,
          };
          if (folder.items[action.itemIndex]._state === "active") {
            const title = folder.items[action.itemIndex].title;
            setContext((c) => ({
              ...c,
              emulator: {
                ...c.emulator,
                command: {
                  ...c.emulator.command,
                  title: title,
                },
              },
            }));
          }
        }
      }
      save(newMenu);
    },
    [props.saveTo, save, setContext]
  );

  // Group
  const rename = React.useCallback(
    (action: buttonActionProps): void => {
      console.log("Renaming....", props.saveTo);
      if (!menuRef.current) return;
      const newMenu = [...menuRef.current];
      const group = newMenu[action.groupIndex];
      const editProps = {
        _isEditing: true,
        _rightButtons: [],
      };
      if (action.type === "index")
        group.index = {
          ...group.index,
          ...editProps,
          _onClickOutside: (e: React.ChangeEvent<HTMLInputElement>) =>
            saveName(action, e, group.index._rightButtons),
        };
      else if (action.type === "folder" && group.folders)
        group.folders[action.folderIndex] = {
          ...group.folders[action.folderIndex],
          ...editProps,
          _onClickOutside: (e: React.ChangeEvent<HTMLInputElement>) =>
            saveName(
              action,
              e,
              group.folders
                ? group.folders[action.folderIndex]._rightButtons
                : []
            ),
        };
      else if (action.type === "item" && group.items)
        group.items[action.itemIndex] = {
          ...group.items[action.itemIndex],
          ...editProps,
          _onClickOutside: (e: React.ChangeEvent<HTMLInputElement>) =>
            saveName(
              action,
              e,
              group.items ? group.items[action.itemIndex]._rightButtons : []
            ),
        };
      else if (action.type === "folderItem" && group.folders) {
        const folder = group.folders[action.folderIndex];
        if (folder.items)
          folder.items[action.itemIndex] = {
            ...folder.items[action.itemIndex],
            ...editProps,
            _onClickOutside: (e: React.ChangeEvent<HTMLInputElement>) =>
              saveName(
                action,
                e,
                group.folders
                  ? group.folders[action.folderIndex]._rightButtons
                  : []
              ),
          };
      }
      setMenu(newMenu);
    },
    [saveName, props.saveTo]
  );

  const remove = React.useCallback(
    async (action: buttonActionProps): Promise<void> => {
      console.log("Removing....", props.saveTo);
      if (!menuRef.current) return;
      const newMenu = [...menuRef.current];
      if (action.type === "index") newMenu.splice(action.groupIndex, 1);
      else {
        const group = newMenu[action.groupIndex];
        if (action.type === "folder")
          group.folders?.splice(action.folderIndex, 1);
        else if (action.type === "item")
          group.items?.splice(action.itemIndex, 1);
        else if (action.type === "folderItem" && group.folders)
          group.folders[action.folderIndex].items?.splice(action.itemIndex, 1);
      }
      save(newMenu);
    },
    [props.saveTo, save]
  );

  // Item
  const itemRightButtons = React.useCallback(
    (action: buttonActionProps): NavItemProps["_rightButtons"] =>
      props.isEditable
        ? [
            {
              icon: "more_horiz",
              color: "ghost",
              size: "xxs",
              shape: "square",
              id: uid(),
              dropdown: [
                {
                  state: "default",
                  leftText: "Rename",
                  leftIcon: "edit",
                  onClick: () => rename(action),
                },
                {
                  state: "default",
                  leftText: "Delete",
                  leftIcon: "delete",
                  onClick: () => remove(action),
                },
              ],
            },
          ]
        : undefined,
    [props.isEditable, remove, rename]
  );

  const addItem = React.useCallback(
    async (action: buttonActionProps): Promise<void> => {
      if (!menuRef.current) return;
      console.log("Adding Item...", props.saveTo);
      const newMenu = [...menuRef.current];
      const group = newMenu[action.groupIndex];
      const id = uid();
      const newItem = {
        id: id,
        title: "Untitled",
        data: {
          id: id,
          title: "Untitled",
          path: `${action.groupIndex}/items/${group.items?.length || 0}`,
          signals: [],
        },
        _level: 0,
        _state: "default",
        _rightButtons: itemRightButtons({
          type: "item",
          groupIndex: action.groupIndex,
          itemIndex: group.items?.length || 0,
        }),
      };
      if (action.type === "index") group.items = group.items?.concat(newItem);
      else if (action.type === "folder" && group.folders) {
        const folder = group.folders[action.folderIndex];
        folder._isOpen = true;
        folder.items = folder.items ? folder.items.concat(newItem) : [newItem];
      }
      await save(newMenu);
    },
    [itemRightButtons, props.saveTo, save]
  );

  // Folder
  const folderRightButtons = React.useCallback(
    (action: buttonActionProps): NavFolderProps["_rightButtons"] =>
      props.isEditable
        ? [
            {
              icon: "more_horiz",
              color: "ghost",
              size: "xxs",
              shape: "square",
              id: uid(),
              dropdown: [
                {
                  state: "default",
                  leftText: "Rename",
                  leftIcon: "edit",
                  onClick: () => rename(action),
                },
                {
                  state: "default",
                  leftText: "Delete",
                  leftIcon: "delete",
                  onClick: () => remove(action),
                },
              ],
            },
            {
              icon: "add",
              color: "ghost",
              size: "xxs",
              shape: "square",
              id: uid(),
              dropdown: [
                {
                  state: "default",
                  leftText: "New Command",
                  leftIcon: "sports_esports",
                  onClick: () => addItem(action),
                },
              ],
            },
          ]
        : undefined,
    [addItem, props.isEditable, remove, rename]
  );

  const addFolder = React.useCallback(
    async (action: buttonActionProps) => {
      if (!menuRef.current) return;
      console.log("Adding Item...", props.saveTo);
      const newMenu = [...menuRef.current];
      const group = newMenu[action.groupIndex];
      const newFolder = {
        id: uid(),
        title: "Untitled",
        _parentId: `${group.id}__folders`,
        _level: 0,
        _isOpen: false,
        _rightButtons: folderRightButtons({
          type: "folder",
          groupIndex: action.groupIndex,
          folderIndex: group.folders?.length || 0,
        }),
      };
      if (action.type === "index")
        group.folders = group.folders?.concat(newFolder);
      await save(newMenu);
    },
    [folderRightButtons, props.saveTo, save]
  );

  // Index
  const indexRightButtons = React.useCallback(
    (action: buttonActionProps): NavIndexProps["_rightButtons"] =>
      props.isEditable
        ? [
            {
              icon: "more_horiz",
              color: "ghost",
              size: "xxs",
              shape: "square",
              id: uid(),
              dropdown: [
                {
                  state: "default",
                  leftText: "Rename",
                  leftIcon: "edit",
                  onClick: () => rename(action),
                },
                {
                  state: "default",
                  leftText: "Delete",
                  leftIcon: "delete",
                  onClick: () => remove(action),
                },
              ],
            },
            {
              icon: "add",
              color: "ghost",
              size: "xxs",
              shape: "square",
              id: uid(),
              dropdown: [
                {
                  state: "default",
                  leftText: "New Folder",
                  leftIcon: "create_new_folder",
                  onClick: () => addFolder(action),
                },
                {
                  state: "default",
                  leftText: "New Command",
                  leftIcon: "sports_esports",
                  onClick: () => addItem(action),
                },
              ],
            },
          ]
        : undefined,
    [addFolder, addItem, props.isEditable, remove, rename]
  );

  const removeAll = React.useCallback(async (): Promise<void> => {
    const confirm = window.confirm(
      '"Local" 内の全てのコマンドを削除しますか？\nAre you sure you to delete all commands in "Local"?'
    );
    if (!confirm) return;
    console.log("Removing....", props.saveTo);
    const newMenu: MenuGroupProps[] = [];
    save(newMenu);
  }, [props.saveTo, save]);

  const inactivateItems = React.useCallback((): MenuGroupProps[] | void => {
    if (!menuRef.current) return;
    const newMenu = [...menuRef.current];
    newMenu.forEach((m) => {
      m.items?.forEach((item) => {
        item._state = "default";
      });
      m.folders?.forEach((f) => {
        f.items?.forEach((item) => {
          item._state = "default";
        });
      });
    });
    return newMenu;
  }, []);

  const activateItem = React.useCallback(
    async (action: itemActionProps | folderItemActionProps): Promise<void> => {
      const newMenu = inactivateItems();
      if (!newMenu) return;
      const group = newMenu[action.groupIndex];
      const items =
        action.type === "item"
          ? group.items
          : action.type === "folderItem" && group.folders
          ? group.folders[action.folderIndex].items
          : undefined;
      if (!items) return;
      const item = items[action.itemIndex];
      const path =
        action.type === "item"
          ? `${action.groupIndex}/items/${action.itemIndex}`
          : action.type === "folderItem"
          ? `${action.groupIndex}/folders/${action.folderIndex}/items/${action.itemIndex}`
          : "";
      item._state = "active";
      setActiveItem(item.id);
      save(newMenu, true);
      setContext((c) => ({
        ...c,
        emulator: {
          ...c.emulator,
          command:
            item._state === "active"
              ? {
                  ...item.data,
                  id: item.id,
                  title: item.title,
                  signals: item.data?.signals || [],
                  path: path,
                }
              : {
                  id: "",
                  title: "",
                  path: "",
                  signals: [],
                },
        },
        gamePad: {
          ...c.gamePad,
          ...NeutralGamepadProps,
        },
      }));
    },
    [inactivateItems, save, setContext]
  );

  const createItems = React.useCallback(
    (
      items,
      level: number,
      action: folderItemActionProps | itemActionProps
    ): NavItemProps[] | undefined => {
      if (!items) return;
      return items.map((item: NavItemProps, i: number) => ({
        ...item,
        _level: level,
        _rightButtons: itemRightButtons({
          ...action,
          itemIndex: i,
        }),
        _state: item.id === activeItem ? "active" : item._state || "default",
        _onClick: () =>
          activateItem({
            ...action,
            itemIndex: i,
          }),
      }));
    },
    [activateItem, activeItem, itemRightButtons]
  );

  const createFolders = React.useCallback(
    (
      folders,
      level: number,
      groupIndex: number
    ): NavFolderProps[] | undefined => {
      if (!folders) return;
      return folders.map((folder: NavFolderProps, i: number) => ({
        ...folder,
        _level: level,
        _isOpen: folder._isOpen || false,
        _rightButtons: folderRightButtons({
          type: "folder",
          groupIndex: groupIndex,
          folderIndex: i,
        }),
        items: createItems(folder.items, level + 1, {
          type: "folderItem",
          groupIndex: groupIndex,
          folderIndex: i,
          itemIndex: 0,
        }),
      }));
    },
    [createItems, folderRightButtons]
  );

  const createIndex = React.useCallback(
    (data, i: number): NavIndexProps => {
      const action: buttonActionProps = {
        type: "index",
        groupIndex: i,
      };
      return {
        ...data,
        _rightButtons: indexRightButtons(action),
      };
    },
    [indexRightButtons]
  );

  const convert = React.useCallback(() => {
    return {
      toRaw(data: MenuGroupProps[]) {
        const filterKeys: any = (d: any) =>
          Object.keys(d).filter((key) => !key.startsWith("_"));
        const filterObj = (d1: any) => {
          const keys = filterKeys(d1);
          const d2: { [key: string]: any } = {};
          keys.forEach((key: string) => {
            if (d1[key] !== 0 && !d1[key]) return;
            else if (Array.isArray(d1[key]))
              d2[key] = d1[key].map((d3: MenuGroupProps) =>
                typeof d3 === "object" ? filterObj(d3) : d3
              );
            else if (typeof d1[key] === "object") d2[key] = filterObj(d1[key]);
            else {
              d2[key] = d1[key];
            }
          });
          return d2;
        };
        return data.map((d: MenuGroupProps) => filterObj(d));
      },
      toFormat(data: ProjectDataProps[]): MenuGroupProps[] | undefined {
        if (!data) return undefined;
        return data.map((d, i) => ({
          id: d.id,
          index: createIndex(d.index, i),
          folders: createFolders(d.folders, 0, i) || [],
          items:
            createItems(d.items, 0, {
              type: "item",
              groupIndex: i,
              itemIndex: i,
            }) || [],
        }));
      },
    };
  }, [createFolders, createIndex, createItems]);

  const addNewGroup = React.useCallback(async (): Promise<void> => {
    try {
      if (!menu) return;
      const length = menu.length;
      const id = uid();
      const newGroup = {
        id: id,
        index: createIndex(
          {
            title: "Untitled",
          },
          length
        ),
      };
      await save(menu.concat(newGroup));
    } catch (error) {
      console.error(error);
    }
  }, [createIndex, menu, save]);

  const onDragEnd = React.useCallback(
    (result): void => {
      const { destination, source, type } = result;
      if (!destination) return;
      const { droppableId: from, index: fromIndex } = source;
      const { droppableId: to, index: toIndex } = destination;
      if (from === to && fromIndex === toIndex) return;
      if (!menu) return;
      const newMenu = [...menu];
      // Groups
      if (type === "root") {
        const [removed] = newMenu.splice(fromIndex, 1);
        newMenu.splice(toIndex, 0, removed);
      } else {
        const fromPath: string[] = from.split("__");
        const fromGroup = newMenu.filter((g) => g.id === fromPath[0])[0];
        const toPath: string[] = to.split("__");
        const toGroup = newMenu.filter((g) => g.id === toPath[0])[0];
        if (
          (fromPath[1] === "items" || fromPath[1] === "folders") &&
          (toPath[1] === "items" || toPath[1] === "folders") &&
          fromGroup
        ) {
          const fromItems =
            fromPath.length === 3
              ? fromGroup.folders && fromPath[1] === "folders"
                ? fromGroup.folders.filter((f) => f.id === fromPath[2])[0].items
                : null
              : fromGroup[fromPath[1]];
          const toItems =
            toPath.length === 3
              ? toGroup.folders
                ? toGroup.folders.filter((f) => f.id === toPath[2])[0].items
                : null
              : toGroup[toPath[1]];
          if (!fromItems || !toItems) return;
          const [removed]: any = fromItems.splice(fromIndex, 1);
          if (toPath.length === 3 && toGroup.folders) removed._level = 1;
          if (toPath.length === 2) removed._level = 0;
          toItems.splice(toIndex, 0, removed);
        }
      }
      save(newMenu);
    },
    [menu, save]
  );

  React.useEffect(() => {
    if (props.data) setMenu(convert().toFormat(props.data));
  }, [convert, props, props.data, props.saveTo]);

  return { menu, setMenu, onDragEnd, addNewGroup, removeAll };
};
