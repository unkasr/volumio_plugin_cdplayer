#!/bin/bash

DPKG_ARCH=`dpkg --print-architecture`

if [ ${DPKG_ARCH} = "armhf" ]; then
	LIB_GNUE="/lib/arm-linux-gnueabihf"
elif [ ${DPKG_ARCH} = "i386" ]; then
	LIB_GNUE="/lib/i386-linux-gnu"
fi

echo "Installing cdplayer Dependencies"
sudo apt-get update
# Install the required packages via apt-get
sudo apt-get -y install libdiscid0 eject

# libdiscid package does not create all symlinks
sudo ln -s /usr${LIB_GNUE}/libdiscid.so.0 /usr${LIB_GNUE}/libdiscid.so

# make cd accessable for mpd
sudo usermod -aG cdrom mpd

#requred to end the plugin install
echo "plugininstallend"
