import SearchPaths from "./applications/searchPaths.js";
import ArtSelect from "./applications/artSelect.js";
import TokenHUDSettings from "./applications/tokenHUD.js";
import FilterSettings from "./applications/searchFilters.js";
import { getFileName, getFileNameWithExt, simplifyTokenName, simplifyPath, parseSearchPaths, parseKeywords, isImage, isVideo } from "./scripts/utils.js"

// Default path where the script will look for token art
const DEFAULT_TOKEN_PATHS = ["modules/caeora-maps-tokens-assets/assets/tokens/"];

// List of all accepted monster names
let monsterNameList = [];

// Controls whether found art should be filtered by 5e monster srd
let filterMSRD = true;

// Controls whether a keyword search is to be performed in addition to full-name search
let keywordSearch = false;
let excludedKeywords = [];

// Disables storing of token paths in a cache
let disableCaching = false;

// A cached map of all the found tokens
let cachedTokens = new Map();

// Tokens found with caching disabled
let foundTokens = new Map();

// Tracks if module has been initialized
let initialized = false;

// Keyboard key controlling the pop-up when dragging in a token from the Actor Directory
let actorDirKey = "";

// Controls whether separate popups are displayed for portrait and token art
let twoPopups = false;
let noTwoPopupsPrompt = false;

// Obj used for indicating what title and filter should be used in the Art Select screen
let SEARCH_TYPE = {
    PORTRAIT: "portrait",
    TOKEN: "token",
    BOTH: "both"
}

let debug = false;

let runSearchOnPath = false;

async function registerWorldSettings() {

    game.settings.register("token-variants", "debug", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: val => debug = val
    });

    game.settings.registerMenu("token-variants", "searchPaths", {
        name: game.i18n.localize("token-variants.searchPathsTitle"),
        hint: game.i18n.localize("token-variants.SearchPathsHint"),
        icon: "fas fa-exchange-alt",
        type: SearchPaths,
        restricted: true,
    });

    game.settings.register("token-variants", "searchPaths", {
        scope: "world",
        config: false,
        type: Array,
        default: DEFAULT_TOKEN_PATHS,
        onChange: async function (_) {
            if (game.user.can("SETTINGS_MODIFY"))
                await game.settings.set("token-variants", "forgevttPaths", []);
            await parseSearchPaths(debug);
            if (!disableCaching) cacheTokens()
        }
    });

    game.settings.register("token-variants", "enableTokenHUDButtonForAll", {
        name: game.i18n.localize("token-variants.enableTokenHUDButtonForAllName"),
        hint: game.i18n.localize("token-variants.enableTokenHUDButtonForAllHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });

    game.settings.register("token-variants", "disableCaching", {
        name: game.i18n.localize("token-variants.DisableCachingName"),
        hint: game.i18n.localize("token-variants.DisableCachingHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: disable => { disableCaching = disable; cacheTokens(); }
    });

    game.settings.register("token-variants", "disableAutomaticPopup", {
        name: game.i18n.localize("token-variants.DisableAutomaticPopupName"),
        hint: game.i18n.localize("token-variants.DisableAutomaticPopupHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });

    game.settings.register("token-variants", "filterMSRD", {
        name: game.i18n.localize("token-variants.FilterMSRDName"),
        hint: game.i18n.localize("token-variants.FilterMSRDHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: filter => { filterMSRD = filter; cacheTokens(); }
    });

    game.settings.register("token-variants", "keywordSearch", {
        name: game.i18n.localize("token-variants.KeywordSearchName"),
        hint: game.i18n.localize("token-variants.KeywordSearchHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: kSearch => keywordSearch = kSearch
    });

    game.settings.register("token-variants", "excludedKeywords", {
        name: game.i18n.localize("token-variants.ExcludedKeywordsName"),
        hint: game.i18n.localize("token-variants.ExcludedKeywordsHint"),
        scope: "world",
        config: true,
        type: String,
        default: "and,for",
        onChange: keywords => excludedKeywords = parseKeywords(keywords)
    });

    game.settings.register("token-variants", "actorDirectoryKey", {
        name: game.i18n.localize("token-variants.ActorDirectoryKeyName"),
        hint: game.i18n.localize("token-variants.ActorDirectoryKeyHint"),
        scope: "world",
        config: true,
        type: String,
        choices: {
            "Control": "Ctrl",
            "Shift": "Shift",
            "Alt": "Alt"
        },
        default: "Control",
        onChange: key => actorDirKey = key
    });

    game.settings.register("token-variants", "twoPopups", {
        name: game.i18n.localize("token-variants.TwoPopupsName"),
        hint: game.i18n.localize("token-variants.TwoPopupsHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: val => twoPopups = val
    });

    game.settings.register("token-variants", "twoPopupsNoDialog", {
        name: game.i18n.localize("token-variants.twoPopupsNoDialogName"),
        hint: game.i18n.localize("token-variants.twoPopupsNoDialogHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: val => noTwoPopupsPrompt = val
    });

    game.settings.register("token-variants", "runSearchOnPath", {
        name: game.i18n.localize("token-variants.runSearchOnPathName"),
        hint: game.i18n.localize("token-variants.runSearchOnPathHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: val => runSearchOnPath = val
    });

    // Legacy filter setting, retained in case some users have used this setting
    game.settings.register("token-variants", "portraitFilter", {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });

    // Legacy filter setting, retained in case some users have used this setting
    game.settings.register("token-variants", "tokenFilter", {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });

    game.settings.registerMenu("token-variants", "searchFilterMenu", {
        name: game.i18n.localize("token-variants.searchFilterMenuName"),
        hint: game.i18n.localize("token-variants.searchFilterMenuHint"),
        scope: "world",
        icon: "fas fa-exchange-alt",
        type: FilterSettings,
        restricted: true,
    });

    game.settings.register('token-variants', 'searchFilterSettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            portraitFilterInclude: game.settings.get("token-variants", "portraitFilter"),
            portraitFilterExclude: "",
            portraitFilterRegex: "",
            tokenFilterInclude: game.settings.get("token-variants", "tokenFilter"),
            tokenFilterExclude: "",
            tokenFilterRegex: "",
            generalFilterInclude: "",
            generalFilterExclude: "",
            generalFilterRegex: "",
        },
    });

    game.settings.register("token-variants", "forgevttPaths", {
        scope: "world",
        config: false,
        type: Array,
        default: [],
    });

    filterMSRD = game.settings.get("token-variants", "filterMSRD");
    disableCaching = game.settings.get("token-variants", "disableCaching");
    keywordSearch = game.settings.get("token-variants", "keywordSearch");
    actorDirKey = game.settings.get("token-variants", "actorDirectoryKey");
    twoPopups = game.settings.get("token-variants", "twoPopups");
    noTwoPopupsPrompt = game.settings.get("token-variants", "twoPopupsNoDialog");
    debug = game.settings.get("token-variants", "debug");
    runSearchOnPath = game.settings.get("token-variants", "runSearchOnPath");
}

function registerHUD() {
    game.settings.registerMenu("token-variants", "tokenHUDSettings", {
        name: "Token HUD Settings",
        hint: "Settings for the Token HUD button.",
        scope: "client",
        icon: "fas fa-exchange-alt",
        type: TokenHUDSettings,
        restricted: false,
    });

    game.settings.register("token-variants", "enableTokenHUD", {
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
    });

    game.settings.register("token-variants", "alwaysShowHUD", {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
    });

    game.settings.register("token-variants", "HUDDisplayImage", {
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
    });

    game.settings.register("token-variants", "HUDImageOpacity", {
        scope: "client",
        config: false,
        range: { min: 0, max: 100, step: 1 },
        type: Number,
        default: 50
    });

    async function renderHud(hud, html, token, searchText) {
        if (!game.settings.get("token-variants", "enableTokenHUD")) return;

        const search = searchText ? searchText : token.name;
        if (!search || search.length < 3) return;

        const userHasConfigRights = game.user && game.user.can("FILES_BROWSE") && game.user.can("TOKEN_CONFIGURE");

        let artSearch = await doArtSearch(search, SEARCH_TYPE.TOKEN, false, true);
        let images = artSearch.get(search) || new Map();

        let actorVariants = new Map();
        const tokenActor = game.actors.get(token.actorId);

        if (tokenActor) {
            actorVariants = tokenActor.getFlag('token-variants', 'variants') || [];

            // To maintain compatibility with previous versions
            if (!(actorVariants instanceof Array)){
                actorVariants = [];
            } else if (actorVariants.length != 0 && !(actorVariants[0] instanceof Object)){
                actorVariants.forEach((src, i) => {
                    actorVariants[i] = {imgSrc: src, names: [getFileName(src)]};
                });
            } 
            // end of compatibility code

            // Merge images found through search with variants shared through 'variant' flag
            if (!searchText){
                actorVariants.forEach(variant => {
                    for(let name of variant.names){
                        if(images.has(variant.imgSrc)){
                            if(!images.get(variant.imgSrc).includes(name))
                                images.get(variant.imgSrc).push(name);
                        } else {
                            images.set(variant.imgSrc, [name]);
                        }
                    }
                });
            }
        }

        const alwaysShowHUD = game.settings.get("token-variants", "alwaysShowHUD");
        if (!alwaysShowHUD && images.length < 2 && actorVariants.length == 0) return;

        let imagesParsed = [];
        images.forEach((names, tokenSrc) => {
            const img = isImage(tokenSrc);
            const vid = isVideo(tokenSrc);
            for(let name of names){
                let shared = false;
                if(userHasConfigRights){
                    actorVariants.forEach(variant => {
                        if(variant.imgSrc === tokenSrc && variant.names.includes(name)) {
                            shared = true;
                        }
                    });
                }
                imagesParsed.push({ route: tokenSrc, name: name, used: tokenSrc === token.img, img, vid, type: img || vid, shared: shared }); 
            }  
        });

        const imageDisplay = game.settings.get("token-variants", "HUDDisplayImage");
        const imageOpacity = game.settings.get("token-variants", "HUDImageOpacity") / 100;

        const wildcardDisplay = await renderTemplate('modules/token-variants/templates/sideSelect.html', { imagesParsed, imageDisplay, imageOpacity })

        const is080 = !isNewerVersion("0.8.0", game.data.version)

        let divR = html.find('div.right')
            .append(wildcardDisplay);
        if (!searchText)
            divR.click((event) => {
                let activeButton, clickedButton, tokenButton;
                for (const button of html.find('div.control-icon')) {
                    if (button.classList.contains('active')) activeButton = button;
                    if (button === event.target.parentElement) clickedButton = button;
                    if (button.dataset.action === 'token-variants-side-selector') tokenButton = button;
                }

                if (clickedButton === tokenButton && activeButton !== tokenButton) {
                    tokenButton.classList.add('active');

                    html.find('.token-variants-wrap')[0].classList.add('active');
                    const effectSelector = is080 ? '[data-action="effects"]' : '.effects';
                    html.find(`.control-icon${effectSelector}`)[0].classList.remove('active');
                    html.find('.status-effects')[0].classList.remove('active');
                } else if (event.target.id && event.target.id == "token-variants-side-search") {
                    // Do nothing
                } else {
                    tokenButton.classList.remove('active');
                    html.find('.token-variants-wrap')[0].classList.remove('active');
                }
            });

        html.find('#token-variants-side-search').on('keyup', (event) => {
            if (event.key === 'Enter' || event.keyCode === 13) {
                if (event.target.value.length >= 3) {
                    html.find('.control-icon[data-action="token-variants-side-selector"]').remove();
                    renderHud(hud, html, token, event.target.value);
                }
            }
        });

        if (userHasConfigRights) {
            html.find('#token-variants-side-button').on("contextmenu", () => {
                html.find('.token-variants-button-select').remove();
                html.find('#token-variants-side-search').toggle("active")
            });
        }

        const buttons = html.find('.token-variants-button-select')

        buttons.map((button) => {
            buttons[button].addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                const controlled = canvas.tokens.controlled
                const index = controlled.findIndex(x => x.data._id === token._id)
                const tokenToChange = controlled[index]
                const updateTarget = is080 ? tokenToChange.document : tokenToChange
                updateTarget.update({ img: event.target.dataset.name })
            });
            if (userHasConfigRights) {
                buttons[button].addEventListener('contextmenu', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const controlled = canvas.tokens.controlled;
                    const index = controlled.findIndex(x => x.data._id === token._id);
                    const tokenToChange = controlled[index];
                    const updateTarget = is080 ? tokenToChange.document : tokenToChange;
                    const variantSelected = event.target.dataset.name;
                    const variantSelectedName = event.target.dataset.filename;
                    let tokenActor = game.actors.get(updateTarget.actor.id);
                    if (tokenActor) {
                        let variants = tokenActor.getFlag('token-variants', 'variants') || [];

                        // To maintain compatibility with previous versions
                        if (!(variants instanceof Array)){
                            variants = [];
                        } else if (variants.length != 0 && !(variants[0] instanceof Object)){
                            variants.forEach((src, i) => {
                                variants[i] = {imgSrc: src, names: [getFileName(src)]};
                            });
                        } 
                        // end of compatibility code

                        // Remove selected variant if present in the flag, add otherwise
                        let del = false;
                        let updated = false;
                        for(let variant of variants){
                            if(variant.imgSrc === variantSelected){
                                let fNames = variant.names.filter(name => name !== variantSelectedName);
                                if(fNames.length === 0){
                                    del = true;
                                } else if(fNames.length === variant.names.length){
                                    fNames.push(variantSelectedName);
                                }
                                variant.names = fNames;
                                updated = true;
                                break;
                            }
                        }
                        if(del) variants = variants.filter(variant => variant.imgSrc !== variantSelected);
                        else if (!updated) variants.push({imgSrc: variantSelected, names: [variantSelectedName]});

                        // Set shared variants as an actor flag
                        tokenActor.unsetFlag('token-variants', 'variants');
                        if(variants.length > 0){
                            tokenActor.setFlag('token-variants', 'variants', variants);
                        }
                        event.target.parentNode.querySelector('.fa-share').classList.toggle("active")
                    }
                });
            }
        });

        if (searchText) {
            html.find('#token-variants-side-button')[0].parentNode.classList.add('active');
            html.find('.token-variants-wrap')[0].classList.add('active');
        }
    }

    // Incorporating 'FVTT-TokenHUDWildcard' token hud button 
    Hooks.on('renderTokenHUD', renderHud);
}

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {

    // Initialization should only be performed once
    if (initialized) {
        return;
    }

    await registerWorldSettings();

    if (game.user && game.user.can("FILES_BROWSE") && game.user.can("TOKEN_CONFIGURE")) {
        // Handle actor/token art replacement
        Hooks.on("createActor", async (actor, options, userId) => {
            if (userId && game.user.id != userId)
                return;
            else if (game.settings.get("token-variants", "disableAutomaticPopup") && !keyboard.isDown(actorDirKey))
                return;
            let searchType = twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH;
            displayArtSelect(actor.data.name, (imgSrc) => setActorImage(actor, imgSrc), searchType);
        });
        Hooks.on("createToken", async (tokenDoc, options, userId, op4) => {
            if (!(keyboard.isDown(actorDirKey) && !keyboard.isDown("v"))) return;
            let searchType = twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH;
            // Check to support both 0.7.x and 0.8.x
            if (op4) {
                let token = canvas.tokens.get(options._id);
                displayArtSelect(options.name, (imgSrc) => setActorImage(token.actor, imgSrc, false, token), searchType);
            } else {
                let token = tokenDoc._object;
                displayArtSelect(token.name, (imgSrc) => setActorImage(tokenDoc._actor, imgSrc, false, token), searchType);
            }
        });
        Hooks.on("renderTokenConfig", modTokenConfig);
        Hooks.on("renderActorSheet", modActorSheet);
        await cacheTokens();
    } else if (game.settings.get("token-variants", "enableTokenHUDButtonForAll")) {
        await cacheTokens();
    }
    registerHUD();

    initialized = true;
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
    let fields = html[0].getElementsByClassName("image");
    for (let field of fields) {
        if (field.getAttribute("name") == "img") {
            let el = document.createElement("button");
            el.type = "button";
            el.title = game.i18n.localize("token-variants.TokenConfigButtonTitle");
            el.innerHTML = '<i class="fas fa-images"></i>';
            el.tabIndex = -1;
            el.onclick = async () => displayArtSelect(tokenConfig.object.data.name, (imgSrc) => field.value = imgSrc, SEARCH_TYPE.TOKEN);
            field.parentNode.append(el);
            return;
        }
    }
}

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
    if (!options.editable) return;

    let profile = null;
    let profileQueries = {
        all: [".profile", ".profile-img", ".profile-image"],
        pf2e: [".player-image", ".actor-icon", ".sheet-header img", ".actor-image"]
    }

    for (let query of profileQueries.all) {
        profile = html[0].querySelector(query);
        if (profile) break;
    }

    if(!profile && game.system.id in profileQueries){
        for (let query of profileQueries[game.system.id]) {
            profile = html[0].querySelector(query);
            if (profile) break;
        }
    }

    if (!profile) {
        console.log(game.i18n.localize("token-variants.ProfileListenerError"));
        return;
    }

    profile.addEventListener('contextmenu', function (ev) {
        displayArtSelect(actorSheet.object.name, (imgSrc) => setActorImage(actorSheet.object, imgSrc, true), SEARCH_TYPE.PORTRAIT);
    }, false);
}

/**
 * Search for and cache all the found token art
 */
async function cacheTokens() {
    if (debug) console.log("STARTING: Token Caching");
    cachedTokens.clear();

    if (filterMSRD) {
        await jQuery.getJSON("modules/token-variants/data/monster_srd_names.json", (json) => (monsterNameList = json));
        monsterNameList = monsterNameList.map(name => simplifyTokenName(name));
    }

    if (disableCaching) {
        if (debug) console.log("ENDING: Token Caching (DISABLED)");
        return;
    }

    await findTokens("", "", true);
    cachedTokens = foundTokens;
    foundTokens = new Map();
    if (debug) console.log("ENDING: Token Caching");

}

/**
 * Checks if token image path and name match the provided search text and filters
 * @param search search text
 * @param tokenSrc token image path
 * @param name name of the token
 * @param filters filters to be applied
 * @returns true|false
 */
function searchMatchesToken(search, tokenSrc, name, filters) {

    // Is the search text contained in name/path
    const simplified = runSearchOnPath ? simplifyPath(tokenSrc) : simplifyTokenName(name);
    if (!simplified.includes(search)) return false;
    
    if (!filters) return true;

    // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
    let text;
    if(runSearchOnPath){
        text = decodeURIComponent(tokenSrc);
    } else if (getFileName(tokenSrc) === name){
        text = getFileNameWithExt(tokenSrc);
    } else {
        text = name;
    }

    if (filters.regex) {
        return filters.regex.test(text);
    }
    if (filters.include) {
        if (!text.includes(filters.include)) return false;
    }
    if (filters.exclude) {
        if (text.includes(filters.exclude)) return false;
    }
    return true;
}

/**
 * Search for tokens matching the supplied name
 */
async function findTokens(name, searchType = "", caching = false) {
    if (debug) console.log("STARTING: Token Search", name, searchType, caching);

    // Select filters based on type of search
    let filters = game.settings.get("token-variants", "searchFilterSettings");
    switch (searchType) {
        case SEARCH_TYPE.BOTH:
            filters = {
                include: filters.generalFilterInclude,
                exclude: filters.generalFilterExclude,
                regex: filters.generalFilterRegex
            }
            break;
        case SEARCH_TYPE.PORTRAIT:
            filters = {
                include: filters.portraitFilterInclude,
                exclude: filters.portraitFilterExclude,
                regex: filters.portraitFilterRegex
            }
            break;
        case SEARCH_TYPE.TOKEN:
            filters = {
                include: filters.tokenFilterInclude,
                exclude: filters.tokenFilterExclude,
                regex: filters.tokenFilterRegex
            }
            break;
        default:
            filters = {
                include: "",
                exclude: "",
                regex: ""
            }
    }
    if (filters.regex) filters.regex = new RegExp(filters.regex);

    foundTokens = new Map();
    const simpleName = simplifyTokenName(name);

    if (cachedTokens.size != 0) {
        cachedTokens.forEach((names,tokenSrc)=>{
            for(let n of names){
                if(searchMatchesToken(simpleName, tokenSrc, n, filters)){
                    addTokenToFound(tokenSrc, n);
                }
            }
        });
    } else if (caching || disableCaching) {
        let searchPaths = await parseSearchPaths(debug);
        for (let path of searchPaths.get("data")) {
            await walkFindTokens(path, simpleName, "", filters, false, "");
        }
        for (let [bucket, paths] of searchPaths.get("s3")) {
            for (let path of paths) {
                await walkFindTokens(path, simpleName, bucket, filters, false, "");
            }
        }
        for (let path of searchPaths.get("forge")) {
            await walkFindTokens(path, simpleName, "", filters, true, "");
        }
        for (let rollTableName of searchPaths.get("rolltable")) {
            await walkFindTokens(rollTableName, simpleName, "", filters, false, rollTableName);
        }
    }
    if (debug) console.log("ENDING: Token Search", foundTokens);
    return foundTokens;
}

function addTokenToFound(tokenSrc, name){
    if(foundTokens.has(tokenSrc)){
        if (!foundTokens.get(tokenSrc).includes(name)){
            foundTokens.get(tokenSrc).push(name);
        }
    } else {
        foundTokens.set(tokenSrc, [name]);
    }
}

/**
 * Walks the directory tree and finds all the matching token art
 */
async function walkFindTokens(path, name = "", bucket = "", filters = null, forge = false, rollTableName = "") {
    if (!bucket && !path) return;

    let files = [];
    try {
        if (bucket) {
            files = await FilePicker.browse("s3", path, { bucket: bucket });
        } else if (forge) {
            files = await FilePicker.browse("", path, { wildcard: true });
        } else if (rollTableName) {
            const table = game.tables.contents.find((t) => t.name === rollTableName);
            if (!table){
              ui.notifications.warn(game.i18n.format("token-variants.notifications.warn.invalidTable", { tableId }));
            } else {
                for (let baseTableData of table.data.results) {
                    const path = baseTableData.data.img;
                    const rtName = baseTableData.data.text;
                    if (!name) {
                        addTokenToFound(path, rtName);
                    } else {
                        if(searchMatchesToken(simplifyTokenName(name), path, rtName, filters)){
                            addTokenToFound(path, rtName);
                        }
                    }
                }
            }
            return;
        } else {
            files = await FilePicker.browse("data", path);
        }
    } catch (err) {
        console.log(`${game.i18n.localize("token-variants.PathNotFoundError")} ${path}`);
        return;
    }

    if (files.target == ".") return;

    for (let tokenSrc of files.files) {
        const tName = getFileName(tokenSrc);
        if (!name) {
            addTokenToFound(tokenSrc, tName);
        } else {
            if(searchMatchesToken(simplifyTokenName(name), tokenSrc, tName, filters)){
                addTokenToFound(tokenSrc, tName);
            }
        }
    }
    for (let dir of files.dirs) {
        await walkFindTokens(dir, name, bucket, filters, forge, "");
    }
}

/**
 * Performs searches and displays the Art Select screen with the results.
 * @param name The name to be used as the search criteria
 * @param callback function that will be called with the user selected image path as argument
 * @param searchType (token|portrait|both) indicates whether the window is being displayed for a token search or portrait search or both
 * @param ignoreFilterMSRD boolean that if set to true will ignore the filterMSRD setting
 */
async function displayArtSelect(name, callback, searchType = SEARCH_TYPE.BOTH, ignoreFilterMSRD = false) {

    if (filterMSRD && !ignoreFilterMSRD && !monsterNameList.includes(simplifyTokenName(name))) {
        console.log(`${game.i18n.localize("token-variants.FilterMSRDError")} <b>${name}</b>`);
        return;
    }

    // Set Art Select screen title
    let title = game.i18n.localize("token-variants.SelectScreenTitle");
    if (searchType == SEARCH_TYPE.TOKEN)
        title = game.i18n.localize("token-variants.SelectScreenTitleToken");
    else if (searchType == SEARCH_TYPE.PORTRAIT)
        title = game.i18n.localize("token-variants.SelectScreenTitlePortrait");

    let allImages = await doArtSearch(name, searchType, ignoreFilterMSRD);
    if (!allImages) return;

    let artFound = false;
    let allButtons = new Map();
    allImages.forEach((tokens, search) => {
        let buttons = [];
        tokens.forEach((names,tokenSrc) => {
            artFound = true;
            const vid = isVideo(tokenSrc);
            const img = isImage(tokenSrc);
            for(let name of names){
                buttons.push({
                    path: tokenSrc,
                    img: img,
                    vid: vid,
                    type: vid || img,
                    label: name,
                })
            }
        })
        allButtons.set(search, buttons);
    });

    let searchAndDisplay = ((search) => {
        displayArtSelect(search, callback, searchType, true);
    });

    if (artFound) {
        let artSelect = new ArtSelect(title, name, allButtons, callback, searchAndDisplay);
        artSelect.render(true);
    } else {
        let artSelect = new ArtSelect(title, name, null, callback, searchAndDisplay);
        artSelect.render(true);
    }

}

async function doArtSearch(name, searchType = SEARCH_TYPE.BOTH, ignoreFilterMSRD = false, ignoreKeywords = false) {
    if (debug) console.log("STARTING: Art Search", name, searchType);
    if (filterMSRD && !ignoreFilterMSRD && !monsterNameList.includes(simplifyTokenName(name))) {
        console.log(`${game.i18n.localize("token-variants.FilterMSRDError")} <b>${name}</b>`);
        return null;
    }

    let searches = [name];
    let allImages = new Map();
    let usedTokens = new Set();

    if (keywordSearch && !ignoreKeywords) {
        excludedKeywords = parseKeywords(game.settings.get("token-variants", "excludedKeywords"));
        searches = searches.concat(name.split(/\W/).filter(word => word.length > 2 && !excludedKeywords.includes(word.toLowerCase())).reverse());
    }

    for (let search of searches) {
        if (allImages.get(search) !== undefined) continue;
        let map = await findTokens(search, searchType);
        let tokens = new Map();   
        for (let tokenSrc of map.keys()) {
            if(!usedTokens.has(tokenSrc)){
                usedTokens.add(tokenSrc);
                tokens.set(tokenSrc, map.get(tokenSrc));
            }
        }
        allImages.set(search, tokens);
    }

    if (debug) console.log("ENDING: Art Search");
    return allImages;
}

/**
 * Assign new artwork to the actor
 */
async function setActorImage(actor, tokenSrc, updateActorOnly = false, token = null) {

    let updateDoc = (obj, data) => obj.document ? obj.document.update(data) : obj.update(data);
    updateDoc(actor, { img: tokenSrc });

    if (updateActorOnly)
        return;

    function updateToken(actorToUpdate, tokenToUpdate, imgSrc) {
        updateDoc(actorToUpdate, { "token.img": imgSrc });
        if (tokenToUpdate) {
            updateDoc(tokenToUpdate, { img: imgSrc });
        } else if (actorToUpdate.getActiveTokens().length == 1)
            updateDoc(actorToUpdate.getActiveTokens()[0], { img: imgSrc });
    }

    if (twoPopups && noTwoPopupsPrompt) {
        displayArtSelect(actor.name, (imgSrc) => updateToken(actor, token, imgSrc), SEARCH_TYPE.TOKEN);
    } else if (twoPopups) {
        let d = new Dialog({
            title: "Portrait -> Token",
            content: `<p>${game.i18n.localize("token-variants.TwoPopupsDialogQuestion")}</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    callback: () => updateToken(actor, token, tokenSrc),
                },
                two: {
                    icon: '<i class="fas fa-times"></i>',
                    callback: () => {
                        displayArtSelect(actor.name, (imgSrc) => updateToken(actor, token, imgSrc), SEARCH_TYPE.TOKEN);
                    }
                }
            },
            default: "one",
        });
        d.render(true);
    } else {
        updateToken(actor, token, tokenSrc)
    }
}


// Initialize module
Hooks.once("ready", initialize);

// Make displayArtSelect function accessible through 'game'
Hooks.on("init", function () {
    game.TokenVariants = {
        displayArtSelect: displayArtSelect,
        cacheTokens: cacheTokens
    };
});
