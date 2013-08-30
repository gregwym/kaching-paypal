var util = require('util'),
    debug = require('debug')('kaching-paypal'),
    paypal_sdk = require('paypal-rest-sdk'),
    Strategy = require('kaching').Strategy;

/**
 * `PaypalStrategy` constructor.
 *
 * @param {Object} options
 * @api public
 */
function PaypalStrategy (options) {
  this.name = 'paypal';

  if (!options || !options.client_id || !options.client_secret) {
    throw new Error('PaypalStrategy: missing client_id or client_secret. ');
  }
  options.host = options.host || 'api.sandbox.paypal.com';
  options.port = options.port || '';

  paypal_sdk.configure(options);
}

util.inherits(PaypalStrategy, Strategy);

/**
 * Create payment request.
 *
 * Example:
 *   app.get('/kaching/paypal', function(req, res, next) {
 *     // Setup payment detail in `req.payment`
 *     req.payment = {
 *       amount:{
 *         total:'7.47',
 *         currency:'USD'
 *       },
 *       description:'Kaching paypal test transaction'
 *     };
 *     next();
 *   }, kaching.create('paypal', {
 *     redirect_urls: {
 *       return_url: 'http://localhost:3000/kaching/paypal/return',
 *       cancel_url: 'http://localhost:3000/kaching/paypal/cancel'
 *     }
 *   }));
 *
 * @param {Object} payment
 * @param {Object} options
 * @api protected
 */
PaypalStrategy.prototype.create = function(payment, options) {
  var self = this;

  // Construct payment detail
  var payment_detail = {};
  payment_detail.intent = payment.intent || options.intent || 'sale';
  payment_detail.redirect_urls = payment.redirect_urls || options.redirect_urls;

  // Construct payer detail
  var payer = payment_detail.payer = {};
  payer.payment_method = payment.payment_method || options.payment_method || 'paypal';
  payer.funding_instruments = payment.funding_instruments;
  payer.payer_info = payment.payer_info;

  // Construct transaction detail
  var transactions = payment_detail.transactions = [];
  var transaction = transactions[0] = {};
  transaction.amount = payment.amount;
  transaction.item_list = payment.item_list;
  transaction.description = payment.description;

  // Send create request to paypal
  debug('Creating paypal payment:' + JSON.stringify(payment_detail));
  paypal_sdk.payment.create(payment_detail, function(err, payment){
    if(err){ return self.error(err); }
    self.session[payment.id] = payment;
    debug('Paypal payment created: ' + JSON.stringify(payment));

    var approvalUrl = payment.links.reduce(function(prev, cur) {
      return prev || (cur.rel === 'approval_url' ? cur.href : null);
    }, null);
    debug('Redirecting to approval URL: ' + JSON.stringify(approvalUrl));
    self.redirect(approvalUrl);
  });
};

module.exports = exports = PaypalStrategy;
