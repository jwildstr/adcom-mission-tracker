# AdVenture Communist/AdVenture Ages Mission Tracker
A tool that allows players to calculate missions and view event information in the Hyper Hippo mobile games AdVenture Communist and AdVenture Ages. This tool is NO LONGER available at GitHub Pages as of 1 December 2025 due to architectural changes. Please visit <https://idlegametools.com/adcom-mission-tracker/> for the newest updates!

## How to Use
Click on missions in the "Current" area to mark them as Completed.  Click missions in the "Completed" area to undo that, kicking the newest mission back out.

Each mission has a button of its reward capsule next to it.  Clicking this brings up a pop-up with details on the mission, as well as a calculator.  Click "Details" on the calculator for more info.

Switch between Motherland (main) and Event as well as between AdVenture Communist and AdVenture Ages by clicking on the title's dropdown. Other tools can be accessed by clicking around other icons in the top right.

## Technical Background
The website is mainly a static page built upon a single monolith JS file (`mission-tracker.js`). Let's just say I am interested in refactoring it! The server is a simple Node.js/Express instance running on a Docker container. Game data files are stored server-side and can be updated by server administrators.

## Build Instructions

You'll need a few things set up first, so you can create the environment file.

### PlayFab ID

If you don't have any idea what a PlayFab ID is, you'll want to follow these instructions. If you already know, you can bypass this and do it in a "proper" way.

In order to do anything, you'll need a playfab ID. This is a 16-digit hex string (0-9 and A-F). You can find yours in the settings menu of the game, although it didn't work for me. You can create the necessary account for both games as follows (replace DEVID with your PlayFab ID, and this assumes you're setting it up for iOS):

```
curl -H "Content-Type: application/json" -d '{"DeviceId": "DEVID", "CreateAccount":true, "TitleId": "dc4bb"}' https://dc4bb.playfabapi.com/Client/LoginWithIOSDeviceID
curl -H "Content-Type: application/json" -d '{"DeviceId": "DEVID", "CreateAccount":true, "TitleId": "6bf5"}' https://6bf5.playfabapi.com/Client/LoginWithIOSDeviceID
```

This ID should be in the .env file under `PLAYFAB_DEVICE_ID`. If you follow these instructions, `PLAYFAB_DEVICE_ID_TYPE` will need to be IOS.

### The password

The password is stored encrypted in the .env file. To encrypt your password, use sha256sum as follows (This is for a password of `password`)

```
echo -n password | sha256sum
```

This will give an output of
```
5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8  -
```

The first long string there is your encrypted password. This is used below, but replace with your own.

### .env File
The `.env` file should be structured as follows (again, replace DEVID with your PlayFab ID). If you don't specify a port, it defaults to 3000:

```
# App settings
PORT=
ADMIN_PASSWORD=5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8

# PlayFab settings
PLAYFAB_TITLE_ID_ADCOM=dc4bb
PLAYFAB_TITLE_ID_AGES=6bf5
PLAYFAB_DEVICE_ID=DEVID
PLAYFAB_DEVICE_ID_TYPE=IOS
```
The Git Commit ID is passed in by the build script and exposed as an environment variable by Docker itself.

### Building and launching

The website runs on a Docker container. With Docker Compose installed on a Linux/macOS system, run `build.sh` to start the server. Several directories and files which are not present by default are required. Please contact the developer if you are unsure what should go in here.

Assets/images are not provided in the repository as these are copyrighted material.

Once the website is launched, you can browse to it at http://localhost:3000. To fetch the current data, you'll want to run the following (the versions are the latest as of April 18, 2026, but will likely need updating:
```
# AdCom data
curl -H "Content-Type: application/json" -d '{"title":"6bf5", "version":"6.54", "password":"password"}' http://localhost:8080/api/admin/data-file
# AdAges data
curl -H "Content-Type: application/json" -d '{"title":"dc4bb", "version":"1.34", "password":"password"}' http://localhost:8080/api/admin/data-file
```

## Contributors
The primary maintainer of this website is Enigma since 2022 with Catster providing additional support. Zephyron is the original creator of the Mission/Capsule Tracker and FAQ documents.

### Asset Contributors
* AdCom Wiki (Icons at launch).
* Eris (event icons).
* Julian (Emoji selection, development assistance).
* Phil109 (Crusade icons, development assistance).
* The_Random_Guy (Balance data at launch).
* Vdisco (Propaganda boost animations).

### Code Contributors
* EdricChan (Bugfix, suggestions).
* Enigma (Several features and assistance).
* Manifold0 (Some dark mode styling).
* Skylark (Improved input parsing).
* The-Snide-Sniper (Bugfix, suggestions).

Special thanks to anybody else that has submitted issues or written pull requests!

## Contributing
I welcome any feedback, bug reports, or pull requests.

If you have any questions, comments, or suggestions, please visit the #engineering channel in the [unofficial AdCom Discord](https://discord.gg/VPa4WTM). We are always happy to help.

## License
All files in this repository with the exception of those in `/public/img`, `/docs/icon.png`, and game data files downloaded into `/data` may be modified or redistributed with credit given to the current owner (Enigma) or original owner (Zephyron), given that it ascribes to the Hyper Hippo Fan Content Policy and all legal stipulations.

This material is not official and is not endorsed by Hyper Hippo. For more information, see Hyper Hippo’s Fan Content Policy: (https://hyperhippo.com/fan-content-policy/)

Last updated: 1 December 2025.