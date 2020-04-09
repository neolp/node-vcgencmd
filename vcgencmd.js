"use strict";

var binding = require('./build/Release/binding');
var request = binding.request;


exports.request = request;

/**
 
 */
exports.throttled = function () {
    var answer = request('get_throttled');
    var bits = parseInt(answer.slice(answer.indexOf('=') + 1));
    var ret = new Set()

    if (bits & 1) ret.add('undervoltage') //bit 0 Under - voltage detected
    if (bits & 2) ret.add('freqcapped') //bit 1	Arm frequency capped
    if (bits & 4) ret.add('throttled') //bit 2	Currently throttled
    if (bits & 8) ret.add('templimit') //bit 3	Soft temperature limit active
    if (bits & 65536) ret.add('undervoltagelatch') //bit 16	Under - voltage has occurred
    if (bits & 131072) ret.add('freqcappedlatch') //bit 17	Arm frequency capping has occurred
    if (bits & 262144) ret.add('throttledlatch') //bit 18	Throttling has occurred
    if (bits & 524288) ret.add('templimitlatch') //bit 19	Soft temperature limit has occurred

    return ret;
};
/*
Also what resets bits 16 - 18 ? I'm currently running through a battery and notice that the value of the vcgencmd output is:
throttled=0x50000 but have no idea when the last "has occurred" took place.
There are designed to be persistent since boot, as that is the only safe way of multiple users being able to read them.

However I did add a secret option.
Code: Select all

vcgencmd get_throttled 0x7
Will read a different persistent value, and reset the bitmask specified back to zero.
Be aware that if multiple scripts start using this, you will be clearing each others results, hence why it is not recommended.

vcgencmd get_throttled (without the bitmask specified) will always give you persistent values since boot (even if you have also been using the bitmask form).
*/

/**
 * Measure clock frequency.
 * @param  {string} clock one of 'arm', 'core', 'h264', 'isp', 'v3d', 'uart',
 *                        'pwm', 'emmc', 'pixel', 'vec', 'hdmi', 'dpi'
 * @return {number}
 */
exports.measureClock = function (clock) {
    var answer = request('measure_clock ' + clock);

    // 'frequency(0)=0' or 'error=2 error_msg="Invalid arguments"'
    if (answer[10] === '0' || answer[0] === 'e')
        throw new Error('clock is incorrect');

    return +answer.slice(answer.indexOf('=') + 1);
};

/**
 * Measure voltage.
 * @param  {string} [id='core'] one of 'core', 'sdram_c', 'sdram_i', 'sdram_p'
 * @return {number}
 */
exports.measureVolts = function (id) {
    var answer = request('measure_volts ' + (id || ''));

    // 'bad arguments'
    if (answer[0] === 'b')
        throw new Error('id is incorrect');

    return parseFloat(answer.slice(5));
};

/**
 * Measure core temperature of BCM2835 SoC.
 * @return {number}
 */
exports.measureTemp = function () {
    return parseFloat(request('measure_temp').slice(5));
};

/**
 * Check if the specified codec is enabled.
 * @param  {string} codec one of 'H264', 'MPG2', 'WVC1', 'MPG4', 'MJPG', 'WMV9'
 * @return {boolean}
 */
exports.codecEnabled = function (codec) {
    switch (codec) {
        case 'H264':
        case 'MPG2':
        case 'WVC1':
        case 'MPG4':
        case 'MJPG':
        case 'WMV9':
            break;

        default:
            throw new Error('codec is incorrect');
    }

    return request('codec_enabled ' + codec)[5] === 'e';
};

/**
 * Get the configurations you have set.
 * @param  {string} config specific option, 'int' or 'str'
 * @return {Object|number|string}
 */
exports.getConfig = function (config) {
    if (!config)
        throw new Error('config is incorrect');

    var isNumMap = config === 'int',
        isMap = isNumMap || config === 'str',
        answer = request('get_config ' + config).trim();

    if (isMap)
        return answer.split('\n').reduce(function (res, line) {
            var pair = line.split('=');
            res[pair[0]] = isNumMap ? +pair[1] : pair[1];
            return res;
        }, {});
    else {
        if (/unknown$/.test(answer))
            throw new Error('config is incorrect');

        var pair = answer.split('=');
        return +pair[1] || pair[1];
    }
};

/**
 * Get info about availability of camera.
 * @return {Object} {supported, detected}
 */
exports.getCamera = function () {
    var answer = request('get_camera');
    return {
        supported: answer[10] === '1',
        detected: answer[21] === '1'
    };
};

/**
 * Get how much memory is split between the CPU (arm) and GPU.
 * @param  {string} mem 'arm' or 'gpu'
 * @return {number}
 */
exports.getMem = function (mem) {
    if (!(mem === 'arm' || mem === 'gpu'))
        throw new Error('mem is incorrect');

    return parseInt(request('get_mem ' + mem).slice(4), 10);
};

/**
 * Get height, width, and depth of the display framebuffer
 * @return {Object} {width, height, depth}
 */
exports.getLCDInfo = function () {
    var info = request('get_lcd_info').split(' ');
    return {
        width: +info[0],
        height: +info[1],
        depth: +info[2]
    };
};

/**
 * Flush GPU's L1 cache
 */
exports.cacheFlush = function () {
    request('cache_flush');
};

process.on('exit', function () {
    binding.disconnect();
});
