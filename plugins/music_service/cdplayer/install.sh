#!/bin/bash

echo "Installing cdplayer Dependencies"
sudo apt-get update
# Install the required packages via apt-get
sudo apt-get -y install libdiscid0 eject

# libdiscid package does not create all symlinks
sudo ln -s /usr/lib/arm-linux-gnueabihf/libdiscid.so.0 /usr/lib/arm-linux-gnueabi/libdiscid.so

# make cd accessable for mpd
sudo usermod -aG cdrom mpd

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
