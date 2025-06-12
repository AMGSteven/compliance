/**
 * RealPhoneValidation API integration for compliance checking
 * 
 * This module provides functions to validate phone numbers using the RealPhoneValidation Scrub API
 * It follows the pattern of rejecting specific statuses while allowing certain ones through
 */

// API configuration
const API_KEY = '2699AA84-6478-493F-BF14-299F89BA9719';
const API_URL = 'https://api.realvalidation.com/rpvWebService/RealPhoneValidationScrub.php';

// List of statuses to reject (as per client requirements)
const REJECTED_STATUSES = [
  'disconnected',
  'disconnected-70',
  'unreachable',
  'invalid phone',
  'restricted',
  'ERROR',
  'ERROR bad phone number',
  'ERROR missing token',
  'unauthorized',
  'invalid-format',
  'invalid-phone',
  'bad-zip-code',
  'busy'
];

// List of statuses to explicitly accept
const ACCEPTED_STATUSES = [
  'connected',
  'connected-75',
  'pending'
];

/**
 * Format phone number to just digits
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} Formatted phone number with only digits
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  // Remove all non-digit characters
  return phoneNumber.replace(/\D/g, '');
}

/**
 * Simple XML to JSON parser for the API response
 * @param {string} xmlString - XML response from the API
 * @returns {Object} Parsed response data
 */
function parseXML(xmlString) {
  // Extract values from simple XML format like <tag>value</tag>
  const getTagValue = (tag) => {
    const regex = new RegExp(`<${tag}>(.*?)<\\/${tag}>`, 's');
    const match = xmlString.match(regex);
    return match ? match[1] : null;
  };

  return {
    status: getTagValue('status') || '',
    error_text: getTagValue('error_text') || '',
    iscell: getTagValue('iscell') || '',
    carrier: getTagValue('carrier') || '',
  };
}

/**
 * Interpret the validation result for compliance purposes
 * @param {Object} data - Parsed API response data
 * @returns {Object} Compliance result with validation status
 */
function interpretResult(data) {
  // Check if status is in the rejected list (case-insensitive)
  const isRejected = REJECTED_STATUSES.some(status => 
    data.status.toLowerCase() === status.toLowerCase() || 
    (data.error_text && data.error_text.toLowerCase().includes(status.toLowerCase()))
  );
  
  // Check if status is explicitly accepted
  const isExplicitlyAccepted = ACCEPTED_STATUSES.some(status => 
    data.status.toLowerCase() === status.toLowerCase()
  );
  
  const result = {
    // Valid if status is NOT in rejected list
    isValid: !isRejected,
    rawStatus: data.status || '',
    isCell: data.iscell === 'Y',
    isLandline: data.iscell === 'N',
    carrier: data.carrier || 'Unknown',
    error: data.error_text || '',
    isExplicitlyAccepted
  };
  
  // Additional compliance information
  result.complianceStatus = result.isValid ? 'VALID' : 'INVALID';
  result.riskLevel = result.isValid ? 'LOW' : 'HIGH';
  result.rejectReason = isRejected ? `Rejected status: ${data.status}` : '';
  
  return result;
}

/**
 * Check if a phone number is valid using RealPhoneValidation API
 * @param {string} phoneNumber - The phone number to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validatePhoneNumber(phoneNumber) {
  try {
    // Format the phone number
    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    if (!formattedNumber) {
      return { 
        isValid: false, 
        error: 'Empty or invalid phone number', 
        complianceStatus: 'INVALID',
        riskLevel: 'HIGH'
      };
    }
    
    // Build the API URL
    const url = new URL(API_URL);
    url.searchParams.append('phone', formattedNumber);
    url.searchParams.append('token', API_KEY);
    
    // Call the API
    const response = await fetch(url.toString(), { method: 'GET' });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    // Parse the response
    const responseText = await response.text();
    const data = parseXML(responseText);
    
    // Interpret the result
    return interpretResult(data);
  } catch (error) {
    console.error('RealPhoneValidation API error:', error);
    
    // Return a fallback result with error information
    return { 
      isValid: false, 
      error: error.message || 'Unknown error', 
      complianceStatus: 'ERROR',
      riskLevel: 'HIGH'
    };
  }
}

/**
 * Check if a phone number passes all compliance checks
 * This can be used as a single integration point for the compliance system
 * @param {string} phoneNumber - The phone number to check
 * @returns {Promise<Object>} Compliance check result
 */
export async function checkPhoneCompliance(phoneNumber) {
  try {
    // Validate the phone number format
    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    if (!formattedNumber || formattedNumber.length < 10) {
      return {
        isCompliant: false,
        reason: 'Invalid phone number format',
        details: { phoneNumber }
      };
    }
    
    // Check RealPhoneValidation
    const validationResult = await validatePhoneNumber(formattedNumber);
    
    if (!validationResult.isValid) {
      return {
        isCompliant: false,
        reason: validationResult.rejectReason || 'Failed phone validation',
        details: {
          phoneNumber,
          validationStatus: validationResult.rawStatus,
          carrier: validationResult.carrier,
          isCell: validationResult.isCell
        }
      };
    }
    
    // If we reach here, the phone passed all checks
    return {
      isCompliant: true,
      details: {
        phoneNumber,
        validationStatus: validationResult.rawStatus,
        carrier: validationResult.carrier,
        isCell: validationResult.isCell,
        isExplicitlyAccepted: validationResult.isExplicitlyAccepted
      }
    };
  } catch (error) {
    console.error('Phone compliance check error:', error);
    
    // Return a fallback result with error information
    return {
      isCompliant: false,
      reason: 'System error during compliance check',
      details: { phoneNumber, error: error.message }
    };
  }
}
