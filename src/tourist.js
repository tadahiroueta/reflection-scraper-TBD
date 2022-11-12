/** Responsible for VPN */

const { execSync } = require('child_process'); // terminal library


const UNALTERED_IPS = require("../data/input/unalteredIps.json")


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))


/**
 * Gets ip from execution response - stout
 * 
 * @param {Object} stdout - stdout from terminal execution
 * @returns {string} ip address
 */
const getIp = (stdout) => {
    const stdoutString = stdout.toString()
    const ipLine = stdoutString.split("\n").find((line) => line.includes("IPv4")) // get line from large response
    return ipLine.substring(ipLine.indexOf(":") + 1).trim() // get ip from line
}


/** Waits for disconnection from VPN server */
const disconnectVPN = async () => {
    console.log("Disconnecting VPN...")
    try {
        execSync("openvpn-gui --command disconnect_all")
    }
    catch (error) {}

    while (true) {
        sleep(1000)
        if (UNALTERED_IPS.includes(getIp(execSync("ipconfig")))) break // if has disconnected
}}


/**
 * Waits for successful connection to VPN server
 * 
 * @param {string} country - country of the server
 * @return {boolean} whether the connection was successful
 */
const connectVPN = async (country) => {
    disconnectVPN()

    console.log(`Connecting to ${country}...`)
    execSync(`openvpn-gui --connect ${country}`)

    for (let i = 0; i < 60; i++) { // wait for one minute
        await sleep(1000)
        if (!UNALTERED_IPS.includes(getIp(execSync("ipconfig")))) { // if has established connection
            await sleep(5000)
            return true
    }}
    console.log(`Connection to ${country} VPN no longer available.`)
    return false
}


module.exports = { connectVPN, disconnectVPN }