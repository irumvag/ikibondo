"""
Standard API response helpers.

Every endpoint in Ikibondo must return one of these two shapes:
  Success: {"success": true, "data": {...}, "message": ""}
  Error:   {"success": false, "error": "...", "code": "ERROR_CODE"}

This keeps the mobile and web clients consistent — they always check .success first.
"""
from rest_framework.response import Response
from rest_framework import status


def success_response(data=None, message='', status_code=status.HTTP_200_OK):
    return Response(
        {'success': True, 'data': data if data is not None else {}, 'message': message},
        status=status_code
    )


def created_response(data=None, message='Created successfully.'):
    return success_response(data=data, message=message, status_code=status.HTTP_201_CREATED)


def error_response(error='An error occurred.', code='ERROR', status_code=status.HTTP_400_BAD_REQUEST):
    return Response(
        {'success': False, 'error': error, 'code': code},
        status=status_code
    )
