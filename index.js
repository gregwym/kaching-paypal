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
 * @param {Function} callback
 * @api protected
 */
PaypalStrategy.prototype.create = function(payment, options, callback) {
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

  // Config default options
  if (typeof options.redirect !== 'boolean') {
    options.redirect = payer.payment_method == 'paypal';
  }
  if (typeof options.passToNext !== 'boolean') {
    options.passToNext = payer.payment_method == 'credit_card';
  }

  // Send create request to paypal
  debug('Creating paypal payment:' + JSON.stringify(payment_detail, null, ' '));
  paypal_sdk.payment.create(payment_detail, function(err, payment){
    // Invoke callback
    callback(err, payment);

    // Handle error
    if(err){ return self.error(err); }

    // Store payment in session object
    self.session[payment.id] = payment;
    debug('Paypal payment created: ' + JSON.stringify(payment, null, ' '));

    self.pass();
  });
};

/**
 * Proceed to approval process.
 *
 * @param {Object} payment
 * @param {Object} options
 * @param {Function} callback
 * @api protected
 */
Strategy.prototype.approve = function(payment, options, callback) {
  // Fetch the approval_url, and redirect to let user complete the payment.
  var approvalUrl = payment.links.reduce(function(prev, cur) {
    return prev || (cur.rel === 'approval_url' ? cur.href : null);
  }, null);

  if (approvalUrl) {
    this.redirect(approvalUrl);
  } else {
    return this.error(new Error('Could not find approval_url in payment.links'));
  }
};

/**
 * Execute an approved payment.
 *
 * @param {Object} payment
 * @param {Object} options
 * @param {Function} callback
 * @api protected
 */
Strategy.prototype.execute = function(payment, options, callback) {
  var self = this;
  var execute_payment_details = { payer_id: payment.payer_id };
  paypal_sdk.payment.execute(payment.id, execute_payment_details, function(err, payment){
    // Invoke callback
    callback(err, payment);

    // Handle error
    if(err){ return self.error(err); }

    // Store payment in session object
    self.session[payment.id] = payment;
    debug('Paypal payment executed: ' + JSON.stringify(payment, null, ' '));

    self.pass();
  });
};


module.exports = exports = PaypalStrategy;
