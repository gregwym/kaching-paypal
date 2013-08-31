# Kaching-Paypal

[Kaching](https://github.com/gregwym/kaching) strategy for accepting payment with [Paypal](http://www.paypal.com) Rest API. Base on Paypal Rest SDK.

## Install

	$ npm install kaching-paypal

## Example

Kaching's example uses kaching-paypal. Please refer to: [https://github.com/gregwym/kaching/tree/master/example]().

## Usage

### 0. Setup with Kaching

Paypal strategy require the `client_id` and `client_secret` offered by Paypal to operate. You can obtain them from [https://developer.paypal.com/webapps/developer/applications]().

It use `api.sandbox.paypal.com` as the default paypal host address. Feel free to change it in production environment.

	var PaypalStrategy = require('kaching-paypal');
	var kaching = require('kaching');

	kaching.use(new PaypalStrategy({
	  host: '<paypal_rest_api_endpoint>',        // optional
	  port: '',                                  // optional
	  client_id: '<paypal_client_id>',
	  client_secret: '<paypal_client_secret>'
	}));

### 1. Create a payment

Use `kaching.create`, specifying `paypal` strategy, to create a Paypal payment.
The payment detail should be setup and saved in `req.payment` prior invoking the create middleware.

After kaching created the pending payment, it replaces `req.payment` with the real payment object that was returned from Paypal API. Save it securely. (i.e., together with the user's order.)

	app.get('/kaching/paypal', function(req, res, next) {
	  // Setup payment detail in `req.payment`.
	  req.payment = {
	    amount:{
	      total:'7.47',
	      currency:'USD'
	    },
	    description:'Kaching paypal test transaction'
	  };
	  next();
	}, kaching.create('paypal', {
	  redirect_urls: {
	    return_url: 'http://<return_url>',
	    cancel_url: 'http://<cancel_url>'
	  }
	}), function(req, res) { res.json(req.payment); });

### 2. Redirect user to Paypal to approve the payment

For most of the time, user should redirect to Paypal to complete the payment right away. You can find the page url in `payment.links` and do whatever you want.

Or simpler, replace the last request handler with `kaching.approve` middleware.

	app.get('...', function(req, res, next) {
	  ...
	}, kaching.create('paypal', {
	  ...
	}), function(req, res, next) {
	  console.log(JSON.stringify(req.payment));
	  next();
	}, kaching.approve('paypal'));

If you want to use `kaching.approve` somewhere else, make sure it can read the payment object from `req.payment`.

### 3. Execute the approved payment to complete the transaction

User will be redirect to `return_url` once the payment has been approved. `payer_id` will be specified in `req.query.PayerID`. It is required to execute and complete the payment, so save it securely.

Commonly, execute the payment right after can save many trouble. Here is an example,

	app.get('<return_route>', function(req, res, next) {
	  // Prepare payment information and payerId
	  req.payment = ...;           // Fetch the payment object from anywhere it was saved.
	  req.payment.payer_id = req.query.PayerID;
	  next();
	}, kaching.execute('paypal'), function(req, res) {
	  res.json(req.payment);       // Now the payment has been completed.
	});

## API

### PaypalStrategy(options)

Construct a new `strategy`.

	var options = {
	  host: '<paypal_rest_api_endpoint>',        // optional
	  port: '',                                  // optional
	  client_id: '<paypal_client_id>',
	  client_secret: '<paypal_client_secret>'
	}

### PaypalStrategy#create

Build the payment creation middleware. Use `req.payment` as the payment_detail skeleton.

	req.payment = {
	  intent: '<sale | authorize>',             // default: sale
	  payment_method: '<paypal | credit_card>', // default: paypal
	  funding_instruments: {                    // required when payment_method = credit_card
	    ...   // https://developer.paypal.com/webapps/developer/docs/api/#fundinginstrument-object
	  },
	  amount: {                                 // required
	    ...   // https://developer.paypal.com/webapps/developer/docs/api/#amount-object
	  },
	  item_list: {                              // optional
	    ...   // https://developer.paypal.com/webapps/developer/docs/api/#itemlist-object
	  },
	  description: 'Payment description',       // optional
	  redirect_urls: {                          // required when payment_method = paypal
	    return_url: ...,
	    cancel_url: ...
	  }
	};

### PaypalStrategy#approve

Build the payment approval middleware. Mainly redirect to the `approval_url` in `payment.links`.

### PaypalStrategy#execute

Build the approved payment execution middleware. The middleware find the payment in `req.payment` and execute it with `req.payment.payer_id`.
