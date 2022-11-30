/**********************************************************/
/*                   ID HANDLING METHODS                  */
/**********************************************************/

function uuid(length) {
    return ('xxxx-'.repeat(length / 4 - 1).concat('xxxx')).replace(/x/g, function (c) {
      let r = (Math.random() * 16) | 0
      return r.toString(16)
    })
}

function isValidId(id) {
    return typeof id === 'string' &&
                    id.match(/^[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}$/)
}

// EXPORTS
module.exports = {uuid: uuid, isValidId: isValidId};