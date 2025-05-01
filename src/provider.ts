/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./core.d.ts" />


function init() {

    $ui.register((ctx) => {

        // #region States
        const storedEpisodes = ctx.state<WatchedEpisode[]>([]);
        const currentPage = ctx.state<number>(1);
        const storageSettings = ctx.state<StorageSettings>({ cacheFor: 30});
        const episodesPerPage = ctx.state<number>(5);
        const sortBy = ctx.state<SortBy>({ date: 'desc' });
        // #endregion

        // #region Field Refs
        const storageCacheRef = ctx.fieldRef<string>();
        const episodesPerPageRef = ctx.fieldRef<string>();
        const compactViewRef = ctx.fieldRef<boolean>();
        // #endregion

        // #region Consts
        const flexItemsGap: number = 33;
        const saveSettings = `onSaveSettings_${new Date().getTime()}`;
        const cancelSettings = `onCancel_${new Date().getTime()}`;
        const clearDataEvent = `clearData_${new Date().getTime()}`;
        const settingsEvent = `settings_${new Date().getTime()}`;
        const sortByNameEvent = `onSortByName_${new Date().getTime()}`;
        const sortByDateEvent = `onSortByDate_${new Date().getTime()}`;
        const defaultCacheDays: number = 30;
        // #endregion

        // #region Keys
        const episodesStorageKey = 'episodesStorageKey';
        const settingsStorageKey = 'settings';
        // #endregion

        const tray = ctx.newTray({
            withContent: true,
            iconUrl: 'https://raw.githubusercontent.com/kRYstall9/EpisodesHistory-Plugin/refs/heads/main/src/icons/double-check.png',
            width: '550px'
        });


        // #region Events
        tray.onOpen(() => {
            const settings = $storage.get<StorageSettings>(settingsStorageKey);
            if (settings == null || (settings && Object.keys(settings).length === 0)) {
                storageSettings.set({ cacheFor: 30 });
                storageCacheRef.setValue('30');
            }

            tray.render(() => {
                return getFinalContainer()
            });

            tray.update();
        });

        ctx.dom.onReady(() => {
            clearData();
        })

        ctx.registerEventHandler(saveSettings, () => {

            try {
                const dbSettings = $storage.get<StorageSettings>(settingsStorageKey);
                const settings = storageSettings.get();
                const days = settings.cacheFor;

                if (dbSettings?.cacheFor != days) {
                    const deletingOn = new Date();
                    deletingOn.setDate(deletingOn.getDate() + days);

                    storageSettings.set({
                        ...settings,
                        deletingOn: days == 0 ? null : formatDate(deletingOn, false)
                    });

                    if (days == 0) {
                        ctx.toast.info('Data will not be automatically deleted. You can delete the data through the "Clear" button');
                    }
                    else {
                        ctx.toast.info(`Data will be deleted on ${formatDate(deletingOn, false)}`);
                    }
                }

                $storage.set(settingsStorageKey, storageSettings.get());

                ctx.toast.success('Settings saved');
                tray.render(() => getFinalContainer());
                tray.update();
            }
            catch (error: any) {
                createLogMessage('error', 'saveSettings', error);
                ctx.toast.error('An error occured on saving settings. Check the logs for more information');
            }

        });

        ctx.registerEventHandler(cancelSettings, () => {
            tray.render(() => getFinalContainer());
            tray.update();
        });

        ctx.registerEventHandler(clearDataEvent, () => {
            clearData(true);
        });

        ctx.registerEventHandler(settingsEvent, () => {

            const settings = $storage.get(settingsStorageKey);
            storageSettings.set(settings);

            tray.render(() => {
                return settingsLayout();
            })
            tray.update();
        })

        storageCacheRef.onValueChange((value) => {

            if (value == '') {
                storageCacheRef.setValue('');
                storageSettings.set((prev) => ({ ...prev, cacheFor: -1 }));
                return;
            }

            const updatedValue = parseInt(value.replace(/\D.*$/, ''), 10);

            if (!isNaN(updatedValue)) {
                storageCacheRef.setValue(updatedValue.toString());
                storageSettings.set((prev) => ({ ...prev, cacheFor: updatedValue }));
            }
        });

        compactViewRef.onValueChange((value) => {
            compactViewRef.setValue(value);
            storageSettings.set((prev) => ({ ...prev, compactView: value }));
        })

        ctx.registerEventHandler(sortByNameEvent, () => {
            sortBy.set((prev) => ({ name: prev.name == 'desc' ? 'asc' : 'desc' }));
        });

        ctx.registerEventHandler(sortByDateEvent, () => {
            sortBy.set((prev) => ({ date: prev.date == 'desc' ? 'asc' : 'desc' }));
        });

        // #endregion

        // #region Functions
        function createEntries(episodes: WatchedEpisode[], tray: $ui.Tray, itemsPerPage: number, pageNumber: number, gap?: number, style?: Record<string, string>): any {
            const entries: any = [];
            const settings = storageSettings.get();
            const compactView = settings.compactView;
            const sortingKey = Object.keys(sortBy.get())[0];
            const sorting = sortBy.get()[sortingKey];


            let sortedEntries: WatchedEpisode[] = [];

            sortedEntries = episodes.sort((a, b) => {

                return sortingKey != 'name' ? (new Date((sorting == 'desc' ? b : a).date).getTime() - new Date((sorting == 'desc' ? a : b).date).getTime()) :
                    ((sorting == 'desc' ? b : a).animeName.toLowerCase().localeCompare((sorting == 'desc' ? a : b).animeName.toLowerCase()));

            });

            const paginatedEpisodes = getPaginatedItems(sortedEntries, itemsPerPage, pageNumber);

            for (let episode of paginatedEpisodes) {

                const episodeDate = new Date(episode.date);
                const finalDate = formatDate(episodeDate, !compactView)

                try {
                    entries.push(
                        tray.div({
                            items: [
                                tray.text(episode.animeName, { className: `${compactView ? 'truncate' : 'line-clamp-2 break-normal'}` })
                            ],
                            className: 'col-span-2',
                        }),
                        tray.div({
                            items: [
                                tray.text(`Episode: ${episode.episodeNumber.toString()}`)
                            ],
                            className: 'col-span-1 text-center',
                        }),
                        tray.div({
                            items: [
                                tray.text(finalDate)
                            ],
                            className: 'col-span-1 text-center',
                        }),


                    )
                }
                catch (error) {
                    createLogMessage('error', 'createEntries', error);
                }
            }

            return tray.div({
                items: entries,
                className: 'grid grid-cols-4 overflow-y-auto gap-3 text-xs w-full',
                style: { 'max-height': '250px' }
            })
        }

        function createLogMessage(logLevel: LogLevel, method: string, msg: any) {

            console[logLevel](`[${logLevel.toString().toUpperCase()}] - [${method}] - ${msg}`);
        }

        function pagination(episodes: WatchedEpisode[], tray: $ui.Tray, itemsPerPage: number) {
            const totalEpisodesWatched = episodes.length;
            const totalPages = Math.floor(totalEpisodesWatched / itemsPerPage) + (totalEpisodesWatched % itemsPerPage > 0 ? 1 : 0);
            const pageGroup = 3;
            const pages: any = [];

            const startPage = Math.max(1, currentPage.get() - 1);
            const endPage = Math.min(totalPages, startPage + pageGroup - 1);

            for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
                const updatePage = `update_${pageNumber}`;

                ctx.registerEventHandler(updatePage, () => {
                    if (currentPage.get() === pageNumber) {
                        return;
                    }

                    createLogMessage('debug', 'pagination', `Page requested: ${pageNumber}`);
                    currentPage.set(pageNumber);
                })

                pages.push(
                    tray.button({
                        label: (pageNumber).toString(),
                        size: 'sm',
                        intent: currentPage.get() == (pageNumber) ? "primary" : "gray",
                        onClick: updatePage
                    }
                    ));
            }

            const previousPage = `previousePage${new Date().getTime()}`;
            const nextPage = `nextPage${new Date().getTime()}`;
            const firstPage = `firstPage${new Date().getTime()}`;
            const lastPage = `lastPage${new Date().getTime()}`;


            ctx.registerEventHandler(previousPage, () => {
                const prevPageNumber = currentPage.get();

                if (prevPageNumber <= 1) {
                    return;
                }

                currentPage.set(prevPageNumber - 1);

            })

            ctx.registerEventHandler(nextPage, () => {
                const currentPageNumber = currentPage.get();

                if (currentPageNumber >= totalPages) {
                    return;
                }

                currentPage.set(currentPageNumber + 1);
            })

            ctx.registerEventHandler(firstPage, () => {
                currentPage.set(1);
            })

            ctx.registerEventHandler(lastPage, () => {
                currentPage.set(totalPages);
            })

            episodesPerPageRef.onValueChange((value) => {
                const currentValue = parseInt(value, 10);

                if (!isNaN(currentValue)) {
                    episodesPerPage.set(currentValue);
                    //Reset page number to 1
                    currentPage.set(1);
                }
            })

            const buttonsStyle = 'w-8 h-8 flex items-center justify-center text-xs';

            return tray.div({
                items: [
                    tray.div({
                        items: [
                            tray.button({
                                label: '<<',
                                disabled: currentPage.get() <= 1,
                                onClick: firstPage,
                                className: buttonsStyle
                            }),
                            tray.button({
                                label: '<',
                                disabled: currentPage.get() <= 1,
                                onClick: previousPage,
                                className: buttonsStyle
                            }),
                            ...pages,
                            tray.button({
                                label: '>',
                                disabled: currentPage.get() >= totalPages,
                                onClick: nextPage,
                                className: buttonsStyle
                            }),
                            tray.button({
                                label: '>>',
                                disabled: currentPage.get() >= totalPages,
                                onClick: lastPage,
                                className: buttonsStyle
                            })
                        ],
                        className: 'gap-1 hidden sm:flex'
                    }),
                    tray.div({
                        items: [
                            tray.button({
                                label: '<',
                                disabled: currentPage.get() <= 1,
                                onClick: previousPage,
                                className: buttonsStyle
                            }),
                            tray.button({
                                label: '>',
                                disabled: currentPage.get() >= totalPages,
                                onClick: nextPage,
                                className: buttonsStyle
                            }),
                        ],
                        className: 'gap-1 flex items-end sm:hidden'
                    }),
                    tray.div({
                        items: [
                            tray.text('Ep per page', {
                                className: 'font-bold text-xs'
                            }),
                            tray.select({
                                label: '',
                                options: [
                                    { label: '5', value: '5' },
                                    { label: '10', value: '10' },
                                    { label: '25', value: '25' },
                                    { label: '50', value: '50' },
                                    { label: '100', value: '100' }
                                ],
                                size: 'sm',
                                fieldRef: episodesPerPageRef,
                                value: episodesPerPage.get().toString(),
                            })
                        ],
                        className: 'flex flex-col sm:flex-row gap-1 w-auto items-center whitespace-nowrap'
                    })
                ],
                className: 'flex justify-between mt-4'
            });
        }

        function getPaginatedItems(episodes: WatchedEpisode[], itemsPerPage: number, pageNumber: number) {

            //Page 1 , partire da index 0 -> max  index 4
            //Page 2, partire da index 5 -> max index 9 -> max index = (itemsPerPage * pageNumber) - 1  / min index = (itemsPerPage * (pageNumber-1))
            let minIndex = 0;
            let maxIndex = 0;

            if (pageNumber > 1) {
                minIndex = itemsPerPage * (pageNumber - 1);
            }

            maxIndex = (itemsPerPage * pageNumber);

            return episodes.slice(minIndex, maxIndex);
        }

        function getFinalContainer() {
            const dbSettings = $storage.get(settingsStorageKey);
            let finalItem: any;

            if (Object.keys(dbSettings).length === 0) {
                try {
                    finalItem = tray.div({
                        items: [
                            settingsLayout(true)
                        ],
                    });
                }
                catch (error: any) {
                    createLogMessage('error', 'Get settings from db', error);
                }
            }
            else {
                storageSettings.set(dbSettings);

                finalItem = tray.div({
                    items: [
                        header('History'),
                        createSortButtons(storedEpisodes.get()),
                        createEntries(storedEpisodes.get(), tray, episodesPerPage.get(), currentPage.get(), flexItemsGap),
                        pagination(storedEpisodes.get(), tray, episodesPerPage.get())
                    ],
                    className: 'container flex flex-col content-center m-0 p-0'
                })
            }
            return finalItem;
        }

        function formatDate(date: Date, includeTime: boolean = true) {
            const hours = padStart(date.getHours());
            const minutes = padStart(date.getMinutes());
            const month = padStart(date.getMonth() + 1);
            const day = padStart(date.getDate());

            return `${date.getFullYear()}/${month}/${day} ${includeTime ? `${hours}:${minutes}` : ''} `.trim();
        }

        function padStart(num: number): string {
            return (num < 10 ? '0' : '') + num;
        }

        function toDateOnly(date: Date): Date {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }

        function clearData(userClearData: boolean = false) {
            try {
                const episodesKey = $store.get(episodesStorageKey);
                const dbSettings = $storage.get<StorageSettings>(settingsStorageKey);

                if (dbSettings != null) {
                    const deletingOn = dbSettings['deletingOn'];
                    const cacheFor = dbSettings['cacheFor'];
                    const now = toDateOnly(new Date());
                    const episodesStored = $storage.get(episodesKey);

                    if (episodesStored && episodesStored.length == 0) {
                        return;
                    }

                    if (userClearData) {
                        //User clicked Clear Data
                        ctx.toast.info('Deleting data');
                        $storage.remove(episodesKey);
                        ctx.toast.success('Data cleared successfully');
                        storedEpisodes.set([]);
                        return;
                    }

                    if (deletingOn) {

                        const parsedDeletingOn = toDateOnly(new Date(deletingOn));

                        if (now >= parsedDeletingOn) {
                            ctx.toast.info('Deleting data');
                            $storage.remove(episodesKey);

                            ctx.toast.success('Data cleared successfully');

                            const newDate = new Date();
                            newDate.setDate(newDate.getDate() + cacheFor);

                            $storage.set(settingsStorageKey, { cacheFor: cacheFor, deletingOn: newDate });
                            ctx.toast.info(`The history will be deleting again on ${formatDate(newDate, false)}`);
                        }
                    }
                }
            }
            catch (error) {
                createLogMessage('error', 'ctx.dom.onReady', error);
                ctx.toast.error('Error on deleting past data. Check the logs for more information');
            }
        }

        function settingsLayout(isSetup: boolean = false) {

            return tray.div({
                items: [
                    header(`${isSetup ? 'Setup' : 'Settings'}`, false),
                    tray.div({
                        items: [
                            tray.div({
                                items: [
                                    tray.input({
                                        label: `Days before wiping the data - 0 = Keep history ${isSetup ? `(Default: ${defaultCacheDays})` : ''}`,
                                        fieldRef: storageCacheRef,
                                        value: storageSettings.get().cacheFor.toString(),
                                        className: 'font-semibold'
                                    }),
                                    tray.text('Avoid entering values over 365 days if you have limited space', {
                                        style: { 'display': 'block', 'color': 'yellow', 'font-size': '12px' }
                                    }),
                                    tray.text('Insert values >= 0', { className: 'text-xs', style: { 'display': `${(storageSettings.get().cacheFor == -1) ? 'block' : 'none'}`, 'color': 'red' } }),
                                ],
                                className: 'flex flex-col items-start'
                            }),
                            tray.div({
                                items: [
                                    tray.switch({
                                        label: 'Compact view',
                                        fieldRef: compactViewRef,
                                        value: storageSettings.get().compactView ?? false
                                    })
                                ]
                            })
                        ],
                        className: 'flex flex-col mb-4'
                    }),
                    tray.div({
                        items: [
                            tray.button({
                                label: 'Save',
                                intent: 'primary',
                                className: `text-sm ${isSetup ? 'w-full' : 'w-1/2'}`,
                                onClick: saveSettings,
                                disabled: storageSettings.get().cacheFor < 0
                            }),
                            tray.button({
                                label: 'Cancel',
                                intent: 'primary-subtle',
                                className: 'text-sm w-1/2',
                                onClick: cancelSettings,
                                style: { 'display': `${isSetup ? 'none' : 'block'}` }
                            })
                        ],
                        className: 'flex gap-2'
                    })
                ],
                className: 'container flex flex-col content-center m-0 p-0'
            })
        }

        function header(pageName: string, isHomepage: boolean = true) {
            const buttons: any = [];
            if (isHomepage) {
                buttons.push(
                    tray.div({
                        items: [
                            tray.button({
                                label: '⚙️',
                                intent: 'primary',
                                onClick: settingsEvent,
                                className: 'text-xs',
                            }),
                            tray.button({
                                label: '🗑️ Clear',
                                intent: 'alert',
                                onClick: clearDataEvent,
                                disabled: storedEpisodes.get().length <= 0,
                                className: 'text-xs',
                            })
                        ],
                        className: 'flex gap-2'
                    })
                );
            }

            return tray.div({
                items: [
                    tray.div({
                        items: [
                            tray.text(pageName, { className: 'font-bold text-base' }),
                            ...buttons
                        ],
                        className: 'flex flex-row content-between items-center',
                    }),
                    tray.div({
                        items: [],
                        className: 'w-1/2 border-b border-2 self-center rounded mt-2 mb-4',
                    }),
                ],
                className: 'flex flex-col'
            })
        }

        function createSortButtons(episodes: WatchedEpisode []) {
            return tray.div({
                items: [
                    tray.div({
                        items: [
                            tray.button({
                                label: `${sortBy.get()?.name == 'desc' ? '↑' : '↓'}`,
                                onClick: sortByNameEvent,
                                className: `px-2 py-1 text-xs border bg-transparent ${episodes.length <= 0 ? 'hidden' : 'block'}`
                            }),
                        ],
                        className: 'col-span-2 flex justify-center'
                    }),
                    tray.div({
                        items: [],
                        className: 'col-span-1'
                    }),
                    tray.div({
                        items: [
                            tray.button({
                                label: `${sortBy.get()?.date == 'desc' ? '↑' : '↓'}`,
                                onClick: sortByDateEvent,
                                className: `px-2 py-1 text-xs border bg-transparent ${episodes.length <= 0 ? 'hidden' : 'block'}`
                            })],
                        className: 'col-span-1 flex justify-center'
                    }),

                ],
                className: 'grid grid-cols-4 overflow-y-auto gap-3 text-xs w-full'
            })
        }

        // #endregion

        // #region Watch
        $store.watch<WatchedEpisode[]>('episodes', (value) => {
            if (!value) {
                return;
            }
            storedEpisodes.set(value);
            const episodesKey = $store.get(episodesStorageKey);
            $storage.set(episodesKey, storedEpisodes.get());
        });

        $store.watch('onPreUpdateEntryProgress', (value) => {
            if (!value) {
                return;
            }

            const mediaId = value.mediaId;
            const progress: number | undefined = value.progress;
            const episodesStorageKey = $store.get<string>('episodesStorageKey');
            const dbSettings = $storage.get('settings');

            if (mediaId == null || progress == null) {
                createLogMessage('error', 'onPreUpdateEntryProgress', `MediaId is null: ${mediaId == null} - Progress is null: ${progress == null}`);
                return;
            }

            if (Object.keys(dbSettings).length === 0) {
                createLogMessage('warn', 'onPreUpdateEntryProgress', 'User did not insert any settings. Not keeping track of the progress');
                ctx.toast.warning('Not keeping track of the progress. Open the tray and insert the requested values');
                return;
            }

            try {
                createLogMessage('debug', 'onPreUpdateEntryProgress', `MediaId: ${mediaId}`);
                let anime: any;
                try {
                    anime = $anilist.getAnime(mediaId);
                }
                catch (error) {
                    createLogMessage('info', 'onPreUpdateEntryProgress', `Media Id:${mediaId} is not an anime. History won't be updated`);
                    return;
                }

                if (anime != null) {
                    createLogMessage('debug', 'onPreUpdateEntryProgress', 'Anime successfully fetched');

                    const animeName = (anime.title.english ?? anime.title.romaji).replace(/^"(.*)"$/, '$1');
                    createLogMessage('debug', 'onPreUpdateEntryProgress', 'Anime Retrieved from the storage');
                    const now = new Date();
                    const watchedDate = formatDate(now);

                    createLogMessage('debug', 'onPreUpdateEntryProgress', `AnimeName: ${animeName}\tDateWatched:${watchedDate}\tEpisodeNumber: ${progress}`);

                    const watchEpisode: WatchedEpisode = {
                        animeName: animeName,
                        date: watchedDate,
                        episodeNumber: progress
                    };

                    if (!$storage.has(episodesStorageKey)) {
                        createLogMessage('debug', 'onPreUpdateEntryProgress', 'Creating storage key');
                        $storage.set(episodesStorageKey, []);
                    }

                    const dbStoredEpisodes: WatchedEpisode[] | undefined = $storage.get(episodesStorageKey);

                    if (dbStoredEpisodes) {
                        let storedEpisodesUpdated = [...dbStoredEpisodes];
                        storedEpisodesUpdated.push(watchEpisode);
                        $storage.set(episodesStorageKey, storedEpisodesUpdated);
                        storedEpisodes.set([...storedEpisodesUpdated]);
                        createLogMessage('debug', 'onPreUpdateEntryProgress', `${watchEpisode.animeName} Episode:${watchEpisode.episodeNumber} added to watched episodes`);
                    }

                }
            }
            catch (error: any) {
                createLogMessage('error', 'onPreUpdateEntryProgress', error);
            }
        });
        // #endregion

        // #region Store Keys
        if (!$store.has(episodesStorageKey)) {
            createLogMessage('debug', '$store.has(episodesStorageKey)', 'episodesStorageKey saved in $store');
            $store.set(episodesStorageKey, 'episodes');
        }

        if (!$store.has('createLogMessage')) {
            createLogMessage('debug', '$store.has(createLogMessage)', 'createLogMessage ref saved in $store');
            $store.set('createLogMessage', createLogMessage);
        }

        if (!$store.has('toast')) {
            createLogMessage('debug', '$store.has(toast)', 'toast ref saved in $store');
            $store.set('toast', ctx.toast);
        }

        if (!$store.has('storedEpisodes')) {
            createLogMessage('debug', '$store.has(storedEpisodes)', 'storedEpisodes ref saved in $store');

            $store.set('storedEpisodes', storedEpisodes);
        }
        // #endregion

        // #region Storage keys
        if ($storage.has('episodes')) {
            createLogMessage('debug', '$storage.has(episodes)', 'Reading episodes from DB');
            const dbEps = $storage.get('episodes');
            storedEpisodes.set(dbEps);
        }

        if (!$storage.has(settingsStorageKey)) {
            $storage.set(settingsStorageKey, {});
        }

        const settings = $storage.get(settingsStorageKey);
        if (settings && Object.keys(settings).length === 0) {
            ctx.toast.warning('Not keeping track of the progress. Open the tray and insert the requested values');
        }
        // #endregion


        tray.render(() => {
            return getFinalContainer()
        });


    });

    $app.onPreUpdateEntryProgress((e) => {
        $store.set('onPreUpdateEntryProgress', $clone(e));
        e.next();

    });

}

// #region Types
type WatchedEpisode = {
    animeName: string
    episodeNumber: number
    date: string
}

type LogLevel = "error" | "warn" | "info" | "debug";

type StorageSettings = {
    cacheFor: number,
    deletingOn?: string | null
    compactView?: boolean
}

type StoreAnime = {
    animeId: number,
    animeName: string,
    episodes: Array<$app.Anime_Episode>
}

type SortBy = {

    name?: 'asc' | 'desc',
    date?: 'asc' | 'desc'

}

// #endregion