from django.urls import path
from . import views

urlpatterns = [
    # GET /api/federation/grid/
    # Returns aggregated approved materials from all active peer instances.
    path('grid/', views.grid, name='federation-grid'),

    # GET /api/federation/instances/
    # Returns the list of active peer nodes (for admin display).
    path('instances/', views.instances, name='federation-instances'),
]
